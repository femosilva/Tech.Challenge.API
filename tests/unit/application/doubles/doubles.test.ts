import { beforeEach, describe, expect, test } from 'bun:test';
import { Peca } from '@domain/estoque/peca.aggregate';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { OrdemServicoRepositorioEmMemoria, PecaRepositorioEmMemoria } from './repositorios-em-memoria.test';
import { PublicadorEventosEmMemoria } from './publicador-eventos-memoria.test';
import { UnitOfWorkEmMemoria } from './unit-of-work-em-memoria.test';

describe('doubles em memória', () => {
  let pecas: PecaRepositorioEmMemoria;
  let ordens: OrdemServicoRepositorioEmMemoria;
  let uow: UnitOfWorkEmMemoria;
  let peca: Peca;

  beforeEach(async () => {
    pecas = new PecaRepositorioEmMemoria();
    ordens = new OrdemServicoRepositorioEmMemoria();
    uow = new UnitOfWorkEmMemoria({ ordens, pecas });
    peca = Peca.cadastrar({ codigo: 'P1', nome: 'Filtro', preco: Dinheiro.deCentavos(1000), saldo: Quantidade.de(5) });
    await pecas.salvar(peca);
  });

  test('repositório devolve cópias: alterar o carregado não muda o guardado', async () => {
    const carregada = (await pecas.buscarPorId({ id: peca.id }))!;
    carregada.darBaixa(Quantidade.de(2));
    expect((await pecas.buscarPorId({ id: peca.id }))!.saldo.valor).toBe(5);
    await pecas.salvar(carregada);
    expect((await pecas.buscarPorId({ id: peca.id }))!.saldo.valor).toBe(3);
  });

  test('cópia preserva o comportamento e não traz eventos pendentes', async () => {
    const carregada = (await pecas.buscarPorId({ id: peca.id }))!;
    expect(carregada).toBeInstanceOf(Peca);
    expect(carregada.equals(peca)).toBe(true);
    expect(carregada.puxarEventos()).toEqual([]);
  });

  test('busca por código', async () => {
    expect((await pecas.buscarPorCodigo({ codigo: 'P1' }))!.id).toBe(peca.id);
    expect(await pecas.buscarPorCodigo({ codigo: 'X' })).toBeNull();
  });

  test('remove', async () => {
    await pecas.remover({ id: peca.id });
    expect(await pecas.buscarPorId({ id: peca.id })).toBeNull();
  });

  test('UnitOfWork confirma quando o trabalho termina', async () => {
    await uow.executar(async ({ pecas: repo }) => {
      const p = (await repo.buscarPorId({ id: peca.id }))!;
      p.darBaixa(Quantidade.de(1));
      await repo.salvar(p);
    });
    expect((await pecas.buscarPorId({ id: peca.id }))!.saldo.valor).toBe(4);
  });

  test('UnitOfWork desfaz tudo, inclusive a OS já salva, quando o trabalho lança', async () => {
    const os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    await ordens.salvar(os);

    const falha = new Error('falhou no meio');
    await expect(
      uow.executar(async ({ ordens: o, pecas: p }) => {
        const osCarregada = (await o.buscarPorId({ id: os.id }))!;
        osCarregada.iniciarDiagnostico();
        await o.salvar(osCarregada);
        const pecaCarregada = (await p.buscarPorId({ id: peca.id }))!;
        pecaCarregada.darBaixa(Quantidade.de(5));
        await p.salvar(pecaCarregada);
        throw falha;
      }),
    ).rejects.toBe(falha);

    expect((await ordens.buscarPorId({ id: os.id }))!.status.valor).toBe('RECEBIDA');
    expect((await pecas.buscarPorId({ id: peca.id }))!.saldo.valor).toBe(5);
  });

  test('publicador acumula eventos e expõe os nomes', async () => {
    const publicador = new PublicadorEventosEmMemoria();
    await publicador.publicar(peca.puxarEventos());
    expect(publicador.nomes).toEqual(['PecaCadastrada', 'EstoqueReposto']);
  });
});
