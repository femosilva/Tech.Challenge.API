import { openapi } from '@elysiajs/openapi';
import { identidadeRoutes, type CasosIdentidade } from '@presentation/http/identidade/auth.routes';
import { Elysia, t } from 'elysia';
import { errosHttpPlugin } from './erros-http.plugin';

/** Cresce com as rotas: cada contexto declara o que usa e entra aqui na interseção. */
export type CasosDeUso = CasosIdentidade;

export function criarApp(casos: CasosDeUso) {
  return new Elysia()
    .use(errosHttpPlugin())
    .use(
      openapi({
        documentation: {
          info: {
            title: 'API da Oficina Mecânica',
            version: '1.0.0',
            description: 'MVP do sistema de atendimento e execução de serviços da oficina.',
          },
          tags: [
            { name: 'Sistema', description: 'Verificação de vida do processo' },
            { name: 'Autenticação', description: 'Login das APIs administrativas' },
          ],
        },
      }),
    )
    // Só liveness: não consulta o banco (isso exigiria uma porta na Application).
    .get('/health', () => ({ status: 'ok' as const }), {
      response: t.Object({ status: t.Literal('ok') }),
      detail: { tags: ['Sistema'], summary: 'Verifica se o processo está de pé' },
    })
    .group('/api/v1', (v1) => v1.use(identidadeRoutes(casos)));
}

export type App = ReturnType<typeof criarApp>;
