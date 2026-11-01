import { inteiro, inteiroDoBanco } from '@presentation/http/comum';
import { t } from 'elysia';

// Aqui só o formato; documento válido, placa válida, transição de status e quantidade vivem no domínio.
const referencia = (descricao: string) => t.String({ minLength: 1, maxLength: 64, description: descricao });

export const abrirOrdemServicoBody = t.Object({
  documento: t.String({
    minLength: 1,
    maxLength: 32,
    description: 'CPF ou CNPJ do cliente, com ou sem máscara',
    examples: ['529.982.247-25'],
  }),
  placa: t.String({ minLength: 1, maxLength: 16, description: 'Placa de um veículo do cliente', examples: ['ABC1D23'] }),
});

export const incluirServicoBody = t.Object({ servicoId: referencia('Serviço do catálogo') });

export const incluirPecaBody = t.Object({
  pecaId: referencia('Peça ou insumo do estoque'),
  quantidade: inteiroDoBanco({ description: 'Unidades usadas nesta OS', examples: [2] }),
});

export const listarOrdensQuery = t.Object({
  pagina: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1, description: 'Página, a partir de 1 (padrão 1)' })),
  tamanho: t.Optional(
    t.Numeric({ minimum: 1, multipleOf: 1, description: 'Itens por página (padrão 20; acima de 100 é limitado a 100)' }),
  ),
});

/** O cliente não tem login: identifica-se pelo CPF/CNPJ, junto do número da OS na URL. */
export const documentoHeaders = t.Object({
  'x-documento': t.String({
    minLength: 1,
    maxLength: 32,
    description: 'CPF ou CNPJ do titular da OS, com ou sem máscara',
    examples: ['529.982.247-25'],
  }),
});

const dataHora = t.String({ format: 'date-time', description: 'ISO 8601, em UTC', examples: ['2026-10-01T12:00:00.000Z'] });
const statusOS = t.UnionEnum(['RECEBIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'EM_EXECUCAO', 'FINALIZADA', 'ENTREGUE']);
const centavos = inteiro({ description: 'Valor em centavos' });

export const ordemServicoResumoResposta = t.Object({
  id: t.String(),
  clienteId: t.String(),
  veiculoId: t.String(),
  status: statusOS,
  totalCentavos: centavos,
  abertaEm: dataHora,
});

export const ordemServicoDetalheResposta = t.Composite([
  ordemServicoResumoResposta,
  t.Object({
    itensServico: t.Array(t.Object({ servicoId: t.String(), precoUnitarioCentavos: centavos })),
    itensPeca: t.Array(t.Object({ pecaId: t.String(), quantidade: inteiro(), precoUnitarioCentavos: centavos })),
    orcamento: t.Nullable(
      t.Object({
        enviado: t.Boolean(),
        decisao: t.UnionEnum(['PENDENTE', 'APROVADO', 'REJEITADO']),
        totalCentavos: centavos,
      }),
    ),
    historico: t.Array(t.Object({ status: statusOS, alteradoEm: dataHora })),
    inicioExecucao: t.Nullable(dataHora),
    fimExecucao: t.Nullable(dataHora),
  }),
]);

export const paginaOrdensResposta = t.Object({
  pagina: inteiro(),
  tamanho: inteiro(),
  total: inteiro({ description: 'Total de OS, somando todas as páginas' }),
  itens: t.Array(ordemServicoResumoResposta),
});

export const tempoMedioResposta = t.Object({
  ordensConsideradas: inteiro({ description: 'Só OS com execução concluída entram na média' }),
  mediaMs: t.Nullable(t.Number({ description: 'Média em milissegundos; null quando nenhuma OS entrou' })),
});
