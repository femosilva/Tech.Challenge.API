import { mock } from 'bun:test';
import type { ConfigGuardJwt } from '@presentation/http/auth.guard';
import { type CasosDeUso, criarApp } from '@presentation/http/criar-app';
import { criarRequisitor } from '../../../../integration/support/http';
import type {
  OrdemServicoDetalheDto,
  OrdemServicoResumoDto,
  Pagina,
  TempoMedioExecucaoDto,
} from '@application/ordem-servico';
export const JWT_DE_TESTE: ConfigGuardJwt = { segredo: 'segredo-do-teste-com-bem-mais-de-32-caracteres', algoritmo: 'HS256' };

export const CLIENTE = { id: 'c-1', nome: 'Ana Souza', documento: '52998224725' };
export const VEICULO = { id: 'v-1', clienteId: 'c-1', placa: 'ABC1D23', marca: 'Volkswagen', modelo: 'Gol', ano: 2020 };
export const SERVICO = { id: 's-1', nome: 'Troca de óleo', precoCentavos: 15000 };
export const PECA = { id: 'p-1', codigo: 'FO-001', nome: 'Filtro de óleo', precoCentavos: 4000, saldo: 10 };
const INSTANTE = new Date('2026-10-01T12:00:00.000Z');
export const INSTANTE_ISO = '2026-10-01T12:00:00.000Z';
export const ORDEM_RESUMO: OrdemServicoResumoDto = {
  id: 'o-1',
  clienteId: 'c-1',
  veiculoId: 'v-1',
  status: 'RECEBIDA',
  totalCentavos: 23000,
  abertaEm: INSTANTE,
};
export const ORDEM_DETALHE: OrdemServicoDetalheDto = {
  ...ORDEM_RESUMO,
  itensServico: [{ servicoId: 's-1', precoUnitarioCentavos: 15000 }],
  itensPeca: [{ pecaId: 'p-1', quantidade: 2, precoUnitarioCentavos: 4000 }],
  orcamento: null,
  historico: [{ status: 'RECEBIDA', alteradoEm: INSTANTE }],
  inicioExecucao: null,
  fimExecucao: null,
};
/** Como a API devolve: as datas viram texto ISO 8601. */
export const ORDEM_RESUMO_JSON = { ...ORDEM_RESUMO, abertaEm: INSTANTE_ISO };
export const ORDEM_DETALHE_JSON = {
  ...ORDEM_DETALHE,
  abertaEm: INSTANTE_ISO,
  historico: [{ status: 'RECEBIDA', alteradoEm: INSTANTE_ISO }],
};
const falso = <R>(resultado: R) => ({ executar: mock(async (..._args: unknown[]) => resultado) });

/** Casos de uso falsos com resposta válida: o que se testa aqui é a camada HTTP, não a regra de negócio. */
export function criarCasosFalsos() {
  return {
    autenticar: falso({ token: 'token-de-teste' }),
    cadastrarCliente: falso({ id: 'c-1' }),
    renomearCliente: falso(undefined),
    listarClientes: falso([CLIENTE]),
    obterCliente: falso(CLIENTE),
    removerCliente: falso(undefined),
    listarVeiculosDoCliente: falso([VEICULO]),
    cadastrarVeiculo: falso({ id: 'v-1' }),
    atualizarVeiculo: falso(undefined),
    listarVeiculos: falso([VEICULO]),
    obterVeiculo: falso(VEICULO),
    removerVeiculo: falso(undefined),

    cadastrarServico: falso({ id: 's-1' }),
    atualizarServico: falso(undefined),
    listarServicos: falso([SERVICO]),
    obterServico: falso(SERVICO),
    removerServico: falso(undefined),
    cadastrarPeca: falso({ id: 'p-1' }),
    atualizarPeca: falso(undefined),
    listarPecas: falso([PECA]),
    obterPeca: falso(PECA),
    removerPeca: falso(undefined),
    reporEstoque: falso(undefined),

    abrirOS: falso({ id: 'o-1' }),
    iniciarDiagnostico: falso(undefined),
    incluirServico: falso(undefined),
    incluirPeca: falso(undefined),
    enviarOrcamento: falso(undefined),
    finalizarServico: falso(undefined),
    entregarVeiculo: falso(undefined),
    listarOrdensServico: falso<Pagina<OrdemServicoResumoDto>>({ pagina: 1, tamanho: 20, total: 1, itens: [ORDEM_RESUMO] }),
    detalharOrdemServico: falso<OrdemServicoDetalheDto>(ORDEM_DETALHE),
    consultarAndamento: falso<OrdemServicoDetalheDto>(ORDEM_DETALHE),
    aprovarOrcamento: falso(undefined),
    rejeitarOrcamento: falso(undefined),
    obterTempoMedioExecucao: falso<TempoMedioExecucaoDto>({ ordensConsideradas: 2, mediaMs: 3600000 }),
  } satisfies CasosDeUso;
}

export function criarApiFalsa() {
  const casos = criarCasosFalsos();
  const app = criarApp(casos, JWT_DE_TESTE);
  return { app, casos, requisitar: criarRequisitor(app, JWT_DE_TESTE) };
}
