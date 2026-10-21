import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { AprovarOrcamento } from '@application/ordem-servico/criacao/aprovar-orcamento.use-case';
import { DomainError } from '@domain/core/domain-error';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { UnitOfWorkAdapter } from '@infrastructure/persistence/unit-of-work.adapter';
import { limparBanco, prisma } from '../support/banco-de-teste';
import { prepararCenario } from '../support/cenario-ordem-servico';
import { salvarOsAguardandoAprovacao, salvarPeca, semEventos } from '../support/cenario-de-aprovacao';
import { CPF_ANA } from '../support/dados-de-teste';

const uow = new UnitOfWorkAdapter(prisma);
const aprovar = new AprovarOrcamento(uow, semEventos);

const saldoDe = async (id: string) => (await prisma.peca.findUniqueOrThrow({ where: { id } })).saldo;
const statusDe = async (id: string) => (await prisma.ordemServico.findUniqueOrThrow({ where: { id } })).status;

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('UnitOfWorkAdapter', () => {
  it('confirma o que o trabalho gravou e devolve o valor dele', async () => {
    const cenario = await prepararCenario();
    const os = await salvarOsAguardandoAprovacao(cenario, []);

    const resultado = await uow.executar(async ({ ordens }) => {
      const carregada = (await ordens.buscarPorId({ id: os.id }))!;
      carregada.aprovarOrcamento();
      await ordens.salvar(carregada);
      return 42;
    });

    expect(resultado).toBe(42);
    expect(await statusDe(os.id)).toBe('EM_EXECUCAO');
  });

  it('desfaz tudo quando o trabalho lança: a OS e a peça já gravadas voltam ao que eram', async () => {
    const cenario = await prepararCenario();
    const peca = await salvarPeca('PNE-01', 10);
    const os = await salvarOsAguardandoAprovacao(cenario, [{ peca, quantidade: 3 }]);
    const falha = new Error('falha no meio do trabalho');

    const erro = await uow
      .executar(async ({ ordens, pecas }) => {
        const osCarregada = (await ordens.buscarPorId({ id: os.id }))!;
        osCarregada.aprovarOrcamento();
        await ordens.salvar(osCarregada);
        const pecaCarregada = (await pecas.buscarPorId({ id: peca.id }))!;
        pecaCarregada.darBaixa(Quantidade.de(3));
        await pecas.salvar(pecaCarregada);
        throw falha;
      })
      .catch((e: unknown) => e);

    expect(erro).toBe(falha);
    expect(await statusDe(os.id)).toBe('AGUARDANDO_APROVACAO');
    expect(await saldoDe(peca.id)).toBe(10);
  });
});

describe('AprovarOrcamento com o UnitOfWork real', () => {
  it('aprova a OS e dá baixa em cada peça, na mesma transação', async () => {
    const cenario = await prepararCenario();
    const filtro = await salvarPeca('PNE-01', 10);
    const vela = await salvarPeca('VEL-01', 5);
    const os = await salvarOsAguardandoAprovacao(cenario, [
      { peca: filtro, quantidade: 3 },
      { peca: vela, quantidade: 4 },
    ]);

    await aprovar.executar({ id: os.id, documento: CPF_ANA });

    expect(await statusDe(os.id)).toBe('EM_EXECUCAO');
    expect(await saldoDe(filtro.id)).toBe(7);
    expect(await saldoDe(vela.id)).toBe(1);
  });

  it('saldo insuficiente em uma peça desfaz tudo, inclusive a baixa da peça anterior', async () => {
    const cenario = await prepararCenario();
    const filtro = await salvarPeca('PNE-01', 10);
    const vela = await salvarPeca('VEL-01', 2);
    const os = await salvarOsAguardandoAprovacao(cenario, [
      { peca: filtro, quantidade: 3 },
      { peca: vela, quantidade: 4 },
    ]);

    expect(aprovar.executar({ id: os.id, documento: CPF_ANA })).rejects.toThrow(DomainError);

    expect(await statusDe(os.id)).toBe('AGUARDANDO_APROVACAO');
    expect(await saldoDe(filtro.id)).toBe(10);
    expect(await saldoDe(vela.id)).toBe(2);
  });

  it('aprovações simultâneas de OS que usam a mesma peça não perdem nenhuma baixa', async () => {
    const cenario = await prepararCenario();
    const filtro = await salvarPeca('PNE-01', 20);
    const ordens = [];
    for (let i = 0; i < 8; i++) ordens.push(await salvarOsAguardandoAprovacao(cenario, [{ peca: filtro, quantidade: 1 }]));

    // allSettled: espera todas terminarem mesmo que alguma falhe, para uma falha não vazar transações para o próximo teste
    const resultados = await Promise.allSettled(ordens.map((os) => aprovar.executar({ id: os.id, documento: CPF_ANA })));

    expect(resultados.filter((r) => r.status === 'rejected')).toEqual([]);
    expect(await saldoDe(filtro.id)).toBe(12);
    expect(await prisma.ordemServico.count({ where: { status: 'EM_EXECUCAO' } })).toBe(8);
  });

  it('a mesma OS aprovada duas vezes ao mesmo tempo: uma passa, a outra é recusada e a baixa acontece uma vez só', async () => {
    const cenario = await prepararCenario();
    const filtro = await salvarPeca('PNE-01', 10);
    const os = await salvarOsAguardandoAprovacao(cenario, [{ peca: filtro, quantidade: 3 }]);

    const resultados = await Promise.allSettled([
      aprovar.executar({ id: os.id, documento: CPF_ANA }),
      aprovar.executar({ id: os.id, documento: CPF_ANA }),
    ]);

    expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const recusada = resultados.find((r): r is PromiseRejectedResult => r.status === 'rejected')!;
    expect(recusada.reason).toBeInstanceOf(DomainError);
    expect(await saldoDe(filtro.id)).toBe(7);
    expect(await statusDe(os.id)).toBe('EM_EXECUCAO');
  });

  it('aprovações simultâneas com as mesmas peças em ordem inversa não se travam (deadlock)', async () => {
    const cenario = await prepararCenario();
    const primeira = await salvarPeca('PNE-01', 100);
    const segunda = await salvarPeca('PNE-02', 100);
    const RODADAS = 10; // sem a ordenação das peças, cerca de 80% das rodadas terminam em deadlock
    const rejeitadas: PromiseSettledResult<void>[] = [];

    for (let i = 0; i < RODADAS; i++) {
      const a = await salvarOsAguardandoAprovacao(cenario, [
        { peca: primeira, quantidade: 1 },
        { peca: segunda, quantidade: 1 },
      ]);
      const b = await salvarOsAguardandoAprovacao(cenario, [
        { peca: segunda, quantidade: 1 },
        { peca: primeira, quantidade: 1 },
      ]);
      const resultados = await Promise.allSettled([
        aprovar.executar({ id: a.id, documento: CPF_ANA }),
        aprovar.executar({ id: b.id, documento: CPF_ANA }),
      ]);
      rejeitadas.push(...resultados.filter((r) => r.status === 'rejected'));
    }

    expect(rejeitadas).toEqual([]);
    expect(await saldoDe(primeira.id)).toBe(100 - 2 * RODADAS);
    expect(await saldoDe(segunda.id)).toBe(100 - 2 * RODADAS);
  });
});
