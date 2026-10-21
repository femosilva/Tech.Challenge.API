import { ItemPeca } from '@domain/ordem-servico/item-peca.vo';
import { ItemServico } from '@domain/ordem-servico/item-servico.vo';
import { Orcamento } from '@domain/ordem-servico/orcamento.vo';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { RegistroStatus } from '@domain/ordem-servico/registro-status.vo';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { StatusOS } from '@domain/value-objects/status-os.vo';
import type { Prisma } from '@infrastructure/persistence/generated/client';

/** A OS como o banco a entrega: a linha da tabela mais as três tabelas filhas. */
export type OrdemServicoLinha = Prisma.OrdemServicoGetPayload<{
  include: { itensServico: true; itensPeca: true; historico: true };
}>;

type Filhos = 'itensServico' | 'itensPeca' | 'historico';

/** O que o repository grava: a linha da OS e as filhas sem o `osId`, que o Prisma preenche. */
export type OrdemServicoGravacao = { escalares: Omit<OrdemServicoLinha, Filhos> } & {
  [K in Filhos]: Omit<OrdemServicoLinha[K][number], 'osId'>[];
};

/** As quatro colunas do orçamento são todas nulas ou todas preenchidas; meio-termo é dado corrompido. */
function orcamentoParaDominio(linha: OrdemServicoLinha): Orcamento | undefined {
  const { orcamentoTotalCentavos: total, orcamentoGeradoEm: geradoEm, orcamentoEnviado: enviado, orcamentoDecisao: decisao } = linha;
  if (total === null && geradoEm === null && enviado === null && decisao === null) return undefined;
  if (total === null || geradoEm === null || enviado === null || decisao === null) {
    throw new Error(`Orçamento parcialmente preenchido na OS ${linha.id}`);
  }
  return Orcamento.restaurar({ total: Dinheiro.deCentavos(total), geradoEm, enviado, decisao });
}

/** As filhas já chegam na ordem de `posicao`: quem lê pede o `orderBy`. */
export function paraDominio(linha: OrdemServicoLinha): OrdemServico {
  return OrdemServico.restaurar({
    id: linha.id,
    clienteId: linha.clienteId,
    veiculoId: linha.veiculoId,
    status: linha.status,
    itensServico: linha.itensServico.map((item) =>
      ItemServico.criar({ servicoId: item.servicoId, precoUnitario: Dinheiro.deCentavos(item.precoUnitarioCentavos) }),
    ),
    itensPeca: linha.itensPeca.map((item) =>
      ItemPeca.criar({
        pecaId: item.pecaId,
        quantidade: Quantidade.de(item.quantidade),
        precoUnitario: Dinheiro.deCentavos(item.precoUnitarioCentavos),
      }),
    ),
    historico: linha.historico.map((registro) => RegistroStatus.de(StatusOS.de(registro.status), registro.alteradoEm)),
    orcamento: orcamentoParaDominio(linha),
    inicioExecucao: linha.inicioExecucao ?? undefined,
    fimExecucao: linha.fimExecucao ?? undefined,
  });
}

export function paraGravacao(os: OrdemServico): OrdemServicoGravacao {
  const [abertura] = os.historico;
  if (!abertura) throw new Error(`OS ${os.id} sem histórico de status`);
  const orcamento = os.orcamento;
  return {
    escalares: {
      id: os.id,
      clienteId: os.clienteId,
      veiculoId: os.veiculoId,
      status: os.status.valor,
      abertaEm: abertura.alteradoEm,
      inicioExecucao: os.inicioExecucao ?? null,
      fimExecucao: os.fimExecucao ?? null,
      orcamentoTotalCentavos: orcamento?.total.centavos ?? null,
      orcamentoGeradoEm: orcamento?.geradoEm ?? null,
      orcamentoEnviado: orcamento?.enviado ?? null,
      orcamentoDecisao: orcamento?.decisao ?? null,
    },
    itensServico: os.itensServico.map((item, posicao) => ({
      posicao,
      servicoId: item.servicoId,
      precoUnitarioCentavos: item.precoUnitario.centavos,
    })),
    itensPeca: os.itensPeca.map((item, posicao) => ({
      posicao,
      pecaId: item.pecaId,
      quantidade: item.quantidade.valor,
      precoUnitarioCentavos: item.precoUnitario.centavos,
    })),
    historico: os.historico.map((registro, posicao) => ({
      posicao,
      status: registro.status.valor,
      alteradoEm: registro.alteradoEm,
    })),
  };
}
