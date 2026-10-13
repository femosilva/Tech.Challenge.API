import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { RejeitarOrcamento } from '@application/ordem-servico/rejeitar-orcamento.use-case';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { ClienteRepositorioEmMemoria, OrdemServicoRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

const CPF_MARIA = '529.982.247-25';
const CPF_OUTRO = '111.444.777-35';

describe('RejeitarOrcamento', () => {
  let clientes: ClienteRepositorioEmMemoria;
  let ordens: OrdemServicoRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let rejeitar: RejeitarOrcamento;
  let os: OrdemServico;

  beforeEach(async () => {
    clientes = new ClienteRepositorioEmMemoria();
    ordens = new OrdemServicoRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    rejeitar = new RejeitarOrcamento(clientes, ordens, eventos);

    const maria = Cliente.cadastrar({ nome: 'Maria', documento: CPF_MARIA });
    await clientes.salvar(maria);
    os = OrdemServico.abrir({ clienteId: maria.id, veiculoId: 'v1' });
    os.iniciarDiagnostico();
    os.incluirServico({ servicoId: 's1', precoUnitario: Dinheiro.deCentavos(15000) });
    os.gerarOrcamento();
    os.enviarOrcamento();
    os.puxarEventos();
    await ordens.salvar(os);
  });

  test('o cliente rejeita: a OS volta para Em diagnóstico e publica OrcamentoRejeitado', async () => {
    await rejeitar.executar({ id: os.id, documento: CPF_MARIA });

    const salva = (await ordens.buscarPorId({ id: os.id }))!;
    expect(salva.status.valor).toBe('EM_DIAGNOSTICO');
    expect(salva.orcamento?.decisao).toBe('REJEITADO');
    expect(eventos.nomes).toEqual(['OrcamentoRejeitado']);
  });

  test('documento de outra pessoa vira NaoEncontradoError e a OS não muda', async () => {
    await expect(rejeitar.executar({ id: os.id, documento: CPF_OUTRO })).rejects.toBeInstanceOf(NaoEncontradoError);
    expect((await ordens.buscarPorId({ id: os.id }))!.status.valor).toBe('AGUARDANDO_APROVACAO');
    expect(eventos.publicados).toHaveLength(0);
  });

  test('OS inexistente dá o mesmo erro e a mesma mensagem que documento errado', async () => {
    await expect(rejeitar.executar({ id: 'nao-existe', documento: CPF_MARIA })).rejects.toThrow(
      'Ordem de serviço não encontrado',
    );
    await expect(rejeitar.executar({ id: os.id, documento: CPF_OUTRO })).rejects.toThrow(
      'Ordem de serviço não encontrado',
    );
  });

  test('documento inválido vira DomainError', async () => {
    await expect(rejeitar.executar({ id: os.id, documento: '111.111.111-11' })).rejects.toBeInstanceOf(DomainError);
  });

  test('OS que não está aguardando aprovação vira DomainError', async () => {
    const emDiagnostico = OrdemServico.abrir({ clienteId: os.clienteId, veiculoId: 'v1' });
    emDiagnostico.iniciarDiagnostico();
    await ordens.salvar(emDiagnostico);

    await expect(rejeitar.executar({ id: emDiagnostico.id, documento: CPF_MARIA })).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});
