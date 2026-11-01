import type { ObterTempoMedioExecucao } from '@application/ordem-servico/acompanhamento';
import type { AuthGuard } from '@presentation/http/auth.guard';
import { detalhe, type Executa } from '@presentation/http/comum';
import { PODE_ADMINISTRAR } from '@presentation/http/papeis';
import { Elysia } from 'elysia';
import { tempoMedioResposta } from './ordem-servico.schema';

export type CasosMetricas = { obterTempoMedioExecucao: Executa<ObterTempoMedioExecucao> };

export const metricasRoutes = (casos: CasosMetricas, guard: AuthGuard) =>
  new Elysia({ prefix: '/metricas' }).use(guard).get('/tempo-medio-execucao', () => casos.obterTempoMedioExecucao.executar(), {
    papeis: PODE_ADMINISTRAR,
    response: { 200: tempoMedioResposta },
    detail: detalhe('Métricas', PODE_ADMINISTRAR, 'Tempo médio de execução dos serviços, em milissegundos'),
  });
