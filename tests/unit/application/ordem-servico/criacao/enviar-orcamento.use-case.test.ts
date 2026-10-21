import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { EnviarOrcamento } from '@application/ordem-servico/criacao/enviar-orcamento.use-case';
import { DomainError } from '@domain/core/domain-error';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { PublicadorEventosEmMemoria } from '../../doubles/publicador-eventos-memoria.test';
import { OrdemServicoRepositorioEmMemoria } from '../../doubles/repositorios-em-memoria.test';

describe('EnviarOrcamento', () => {
  let ordens: OrdemServicoRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let enviar: EnviarOrcamento;
  let os: OrdemServico;

  beforeEach(async () => {
    ordens = new OrdemServicoRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    enviar = new EnviarOrcamento(ordens, eventos);
    os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    os.iniciarDiagnostico();
    os.incluirServico({ servicoId: 's1', precoUnitario: Dinheiro.deCentavos(15000) });
    os.incluirPeca({ pecaId: 'p1', quantidade: Quantidade.de(2), precoUnitario: Dinheiro.deCentavos(3500) });
    os.puxarEventos();
    await ordens.salvar(os);
  });

  test('gera e envia o orçamento: a OS vai para Aguardando aprovação com o total dos itens', async () => {
    await enviar.executar({ id: os.id });

    const salva = (await ordens.buscarPorId({ id: os.id }))!;
    expect(salva.status.valor).toBe('AGUARDANDO_APROVACAO');
    expect(salva.orcamento?.total.centavos).toBe(22000);
    expect(salva.orcamento?.enviado).toBe(true);
    expect(eventos.nomes).toEqual(['OrcamentoGerado', 'OrcamentoEnviado']);
  });

  test('OS inexistente vira NaoEncontradoError', async () => {
    await expect(enviar.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('OS sem itens vira DomainError e continua Em diagnóstico', async () => {
    const vazia = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    vazia.iniciarDiagnostico();
    await ordens.salvar(vazia);

    await expect(enviar.executar({ id: vazia.id })).rejects.toBeInstanceOf(DomainError);
    expect((await ordens.buscarPorId({ id: vazia.id }))!.status.valor).toBe('EM_DIAGNOSTICO');
    expect(eventos.publicados).toHaveLength(0);
  });

  test('OS ainda Recebida vira DomainError', async () => {
    const recebida = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    await ordens.salvar(recebida);

    await expect(enviar.executar({ id: recebida.id })).rejects.toBeInstanceOf(DomainError);
  });
});
