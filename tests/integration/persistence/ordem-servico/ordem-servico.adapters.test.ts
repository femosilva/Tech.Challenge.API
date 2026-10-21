import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { Prisma } from '@infrastructure/persistence/generated/client';
import { OrdemServicoRepositoryAdapter } from '@infrastructure/persistence/ordem-servico/ordem-servico-repository.adapter';
import { limparBanco, prisma } from '../../support/banco-de-teste';
import { prepararCenario } from '../../support/cenario-ordem-servico';

const repo = new OrdemServicoRepositoryAdapter(prisma);
const em = (minutos: number) => new Date(Date.UTC(2026, 0, 10, 10, minutos));

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

type Cenario = Awaited<ReturnType<typeof prepararCenario>>;

const abrirEmDiagnostico = ({ cliente, veiculo }: Cenario) => {
  const os = OrdemServico.abrir({ clienteId: cliente.id, veiculoId: veiculo.id }, em(0));
  os.iniciarDiagnostico(em(1));
  return os;
};
const preco = (centavos: number) => Dinheiro.deCentavos(centavos);

describe('OrdemServicoRepositoryAdapter', () => {
  it('salva e restaura uma OS recém aberta', async () => {
    const { cliente, veiculo } = await prepararCenario();
    const os = OrdemServico.abrir({ clienteId: cliente.id, veiculoId: veiculo.id }, em(0));
    await repo.salvar(os);

    const lida = await repo.buscarPorId({ id: os.id });
    expect(lida?.equals(os)).toBe(true);
    expect(lida?.status.valor).toBe('RECEBIDA');
    expect(lida?.historico).toHaveLength(1);
    expect(lida?.itensServico).toHaveLength(0);
    expect(lida?.orcamento).toBeUndefined();
    expect(await repo.buscarPorId({ id: 'inexistente' })).toBeNull();
  });

  it('o fluxo inteiro sobrevive à gravação: itens, orçamento, execução e histórico em ordem', async () => {
    const cenario = await prepararCenario();
    const os = abrirEmDiagnostico(cenario);
    os.incluirServico({ servicoId: cenario.servico.id, precoUnitario: preco(15000) }, em(2));
    os.incluirPeca({ pecaId: cenario.peca.id, quantidade: Quantidade.de(2), precoUnitario: preco(4000) }, em(3));
    os.gerarOrcamento(em(4));
    os.enviarOrcamento(em(5));
    os.aprovarOrcamento(em(6));
    os.finalizar(em(30));
    os.entregar(em(40));
    await repo.salvar(os);

    const lida = await repo.buscarPorId({ id: os.id });
    expect(lida?.status.valor).toBe('ENTREGUE');
    expect(lida?.itensServico.map((i) => [i.servicoId, i.precoUnitario.centavos])).toEqual([[cenario.servico.id, 15000]]);
    expect(lida?.itensPeca.map((i) => [i.pecaId, i.quantidade.valor, i.precoUnitario.centavos])).toEqual([[cenario.peca.id, 2, 4000]]);
    expect(lida?.orcamento?.decisao).toBe('APROVADO');
    expect(lida?.orcamento?.enviado).toBe(true);
    expect(lida?.orcamento?.total.centavos).toBe(23000);
    expect(lida?.orcamento?.geradoEm).toEqual(em(4));
    expect(lida?.inicioExecucao).toEqual(em(6));
    expect(lida?.fimExecucao).toEqual(em(30));
    expect(lida?.duracaoExecucaoMs).toBe(24 * 60_000);
    expect(lida?.historico.map((r) => r.status.valor)).toEqual([
      'RECEBIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'EM_EXECUCAO', 'FINALIZADA', 'ENTREGUE',
    ]);
    expect(lida?.historico.map((r) => r.alteradoEm)).toEqual([em(0), em(1), em(5), em(6), em(30), em(40)]);
    expect((await prisma.ordemServico.findUnique({ where: { id: os.id } }))?.abertaEm).toEqual(em(0));
  });

  it('salvar de novo substitui as filhas em vez de duplicá-las', async () => {
    const cenario = await prepararCenario();
    const os = abrirEmDiagnostico(cenario);
    os.incluirServico({ servicoId: cenario.servico.id, precoUnitario: preco(15000) }, em(2));
    await repo.salvar(os);

    os.incluirServico({ servicoId: cenario.servico.id, precoUnitario: preco(16000) }, em(3));
    os.incluirPeca({ pecaId: cenario.peca.id, quantidade: Quantidade.de(1), precoUnitario: preco(4000) }, em(3));
    await repo.salvar(os);

    expect(await prisma.ordemServico.count()).toBe(1);
    expect(await prisma.itemServico.count()).toBe(2);
    expect(await prisma.itemPeca.count()).toBe(1);
    expect(await prisma.registroStatus.count()).toBe(2);
    const lida = await repo.buscarPorId({ id: os.id });
    expect(lida?.itensServico.map((i) => i.precoUnitario.centavos)).toEqual([15000, 16000]);
  });

  it('rejeitar o orçamento e incluir item limpa as colunas do orçamento no banco', async () => {
    const cenario = await prepararCenario();
    const os = abrirEmDiagnostico(cenario);
    os.incluirServico({ servicoId: cenario.servico.id, precoUnitario: preco(15000) }, em(2));
    os.gerarOrcamento(em(3));
    os.enviarOrcamento(em(4));
    os.rejeitarOrcamento(em(5));
    await repo.salvar(os);
    expect((await repo.buscarPorId({ id: os.id }))?.orcamento?.decisao).toBe('REJEITADO');

    os.incluirPeca({ pecaId: cenario.peca.id, quantidade: Quantidade.de(1), precoUnitario: preco(4000) }, em(6));
    await repo.salvar(os);

    const linha = await prisma.ordemServico.findUnique({ where: { id: os.id } });
    expect(linha).toMatchObject({
      status: 'EM_DIAGNOSTICO',
      orcamentoTotalCentavos: null,
      orcamentoGeradoEm: null,
      orcamentoEnviado: null,
      orcamentoDecisao: null,
    });
    expect((await repo.buscarPorId({ id: os.id }))?.orcamento).toBeUndefined();
  });

  it('a gravação é atômica: se uma filha falha, a OS fica exatamente como estava', async () => {
    const cenario = await prepararCenario();
    const os = abrirEmDiagnostico(cenario);
    os.incluirServico({ servicoId: cenario.servico.id, precoUnitario: preco(15000) }, em(2));
    await repo.salvar(os);

    os.incluirServico({ servicoId: 'servico-que-nao-existe', precoUnitario: preco(1000) }, em(3));
    os.gerarOrcamento(em(4));
    const erro = await repo.salvar(os).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const lida = await repo.buscarPorId({ id: os.id });
    expect(lida?.itensServico.map((i) => i.servicoId)).toEqual([cenario.servico.id]);
    expect(lida?.orcamento).toBeUndefined();
    expect(lida?.historico).toHaveLength(2);
  });
});
