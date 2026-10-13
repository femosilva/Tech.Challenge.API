import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError, ReferenciaInvalidaError } from '@application/core/erros';
import { IncluirPeca } from '@application/ordem-servico/incluir-peca.use-case';
import { DomainError } from '@domain/core/domain-error';
import { Peca } from '@domain/estoque/peca.aggregate';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { OrdemServicoRepositorioEmMemoria, PecaRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('IncluirPeca', () => {
  let ordens: OrdemServicoRepositorioEmMemoria;
  let pecas: PecaRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let incluir: IncluirPeca;
  let os: OrdemServico;
  let filtro: Peca;

  beforeEach(async () => {
    ordens = new OrdemServicoRepositorioEmMemoria();
    pecas = new PecaRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    incluir = new IncluirPeca(ordens, pecas, eventos);

    os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    os.iniciarDiagnostico();
    await ordens.salvar(os);
    filtro = Peca.cadastrar({
      codigo: 'FO-01',
      nome: 'Filtro de óleo',
      preco: Dinheiro.deCentavos(3500),
      saldo: Quantidade.de(2),
    });
    await pecas.salvar(filtro);
  });

  test('inclui a peça com o preço atual e publica PecaIncluida', async () => {
    await incluir.executar({ id: os.id, pecaId: filtro.id, quantidade: 2 });

    const salva = (await ordens.buscarPorId({ id: os.id }))!;
    expect(salva.itensPeca).toHaveLength(1);
    expect(salva.itensPeca[0]!.quantidade.valor).toBe(2);
    expect(salva.total.centavos).toBe(7000);
    expect(eventos.nomes).toEqual(['PecaIncluida']);
  });

  test('não confere nem altera o saldo: aceita quantidade maior que o estoque', async () => {
    await incluir.executar({ id: os.id, pecaId: filtro.id, quantidade: 50 });

    expect((await ordens.buscarPorId({ id: os.id }))!.itensPeca[0]!.quantidade.valor).toBe(50);
    expect((await pecas.buscarPorId({ id: filtro.id }))!.saldo.valor).toBe(2);
  });

  test('OS inexistente vira NaoEncontradoError', async () => {
    await expect(incluir.executar({ id: 'nao-existe', pecaId: filtro.id, quantidade: 1 })).rejects.toBeInstanceOf(
      NaoEncontradoError,
    );
  });

  test('peça inexistente vira ReferenciaInvalidaError e a OS não muda', async () => {
    await expect(incluir.executar({ id: os.id, pecaId: 'nao-existe', quantidade: 1 })).rejects.toBeInstanceOf(
      ReferenciaInvalidaError,
    );
    expect((await ordens.buscarPorId({ id: os.id }))!.itensPeca).toHaveLength(0);
    expect(eventos.publicados).toHaveLength(0);
  });

  test.each([0, -1, 1.5])('quantidade %p vira DomainError', async (quantidade) => {
    await expect(incluir.executar({ id: os.id, pecaId: filtro.id, quantidade })).rejects.toBeInstanceOf(DomainError);
  });

  test('aceita incluir peça com a OS ainda Recebida', async () => {
    const recebida = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    await ordens.salvar(recebida);

    await incluir.executar({ id: recebida.id, pecaId: filtro.id, quantidade: 1 });
    expect((await ordens.buscarPorId({ id: recebida.id }))!.itensPeca).toHaveLength(1);
  });

  test('OS aguardando aprovação não aceita mais itens (DomainError)', async () => {
    await incluir.executar({ id: os.id, pecaId: filtro.id, quantidade: 1 });
    const emAprovacao = (await ordens.buscarPorId({ id: os.id }))!;
    emAprovacao.gerarOrcamento();
    emAprovacao.enviarOrcamento();
    await ordens.salvar(emAprovacao);

    await expect(incluir.executar({ id: os.id, pecaId: filtro.id, quantidade: 1 })).rejects.toBeInstanceOf(
      DomainError,
    );
    expect((await ordens.buscarPorId({ id: os.id }))!.itensPeca).toHaveLength(1);
  });
});
