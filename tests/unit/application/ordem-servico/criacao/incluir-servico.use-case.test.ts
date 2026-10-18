import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError, ReferenciaInvalidaError } from '@application/core/erros';
import { IncluirServico } from '@application/ordem-servico/criacao/incluir-servico.use-case';
import { Servico } from '@domain/catalogo/servico.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { PublicadorEventosEmMemoria } from '../../doubles/publicador-eventos-memoria.test';
import { OrdemServicoRepositorioEmMemoria, ServicoRepositorioEmMemoria  } from '../../doubles/repositorios-em-memoria.test';
describe('IncluirServico', () => {
  let ordens: OrdemServicoRepositorioEmMemoria;
  let servicos: ServicoRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let incluir: IncluirServico;
  let os: OrdemServico;
  let oleo: Servico;

  beforeEach(async () => {
    ordens = new OrdemServicoRepositorioEmMemoria();
    servicos = new ServicoRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    incluir = new IncluirServico(ordens, servicos, eventos);

    os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    os.iniciarDiagnostico();
    await ordens.salvar(os);
    oleo = Servico.cadastrar({ nome: 'Troca de óleo', preco: Dinheiro.deCentavos(15000) });
    await servicos.salvar(oleo);
  });

  test('inclui o serviço com o preço atual do catálogo e publica ServicoIncluido', async () => {
    await incluir.executar({ id: os.id, servicoId: oleo.id });

    const salva = (await ordens.buscarPorId({ id: os.id }))!;
    expect(salva.itensServico).toHaveLength(1);
    expect(salva.itensServico[0]!.servicoId).toBe(oleo.id);
    expect(salva.total.centavos).toBe(15000);
    expect(eventos.nomes).toEqual(['ServicoIncluido']);
  });

  test('mudar o preço no catálogo depois não altera a OS', async () => {
    await incluir.executar({ id: os.id, servicoId: oleo.id });

    oleo.atualizar({ preco: Dinheiro.deCentavos(99900) });
    await servicos.salvar(oleo);

    expect((await ordens.buscarPorId({ id: os.id }))!.total.centavos).toBe(15000);
  });

  test('OS inexistente vira NaoEncontradoError', async () => {
    await expect(incluir.executar({ id: 'nao-existe', servicoId: oleo.id })).rejects.toBeInstanceOf(
      NaoEncontradoError,
    );
  });

  test('serviço inexistente vira ReferenciaInvalidaError e a OS não muda', async () => {
    await expect(incluir.executar({ id: os.id, servicoId: 'nao-existe' })).rejects.toBeInstanceOf(
      ReferenciaInvalidaError,
    );
    expect((await ordens.buscarPorId({ id: os.id }))!.itensServico).toHaveLength(0);
    expect(eventos.publicados).toHaveLength(0);
  });

  test('aceita incluir serviço com a OS ainda Recebida', async () => {
    const recebida = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    await ordens.salvar(recebida);

    await incluir.executar({ id: recebida.id, servicoId: oleo.id });
    expect((await ordens.buscarPorId({ id: recebida.id }))!.itensServico).toHaveLength(1);
  });

  test('OS aguardando aprovação não aceita mais itens (DomainError)', async () => {
    await incluir.executar({ id: os.id, servicoId: oleo.id });
    const emAprovacao = (await ordens.buscarPorId({ id: os.id }))!;
    emAprovacao.gerarOrcamento();
    emAprovacao.enviarOrcamento();
    await ordens.salvar(emAprovacao);

    await expect(incluir.executar({ id: os.id, servicoId: oleo.id })).rejects.toBeInstanceOf(DomainError);
    expect((await ordens.buscarPorId({ id: os.id }))!.itensServico).toHaveLength(1);
  });
});
