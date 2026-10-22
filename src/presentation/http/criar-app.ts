import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';
import { errosHttpPlugin } from './erros-http.plugin';

export function criarApp() {
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
          tags: [{ name: 'Sistema', description: 'Verificação de vida do processo' }],
        },
      }),
    )
    .get('/health', () => ({ status: 'ok' as const }), {
      response: t.Object({ status: t.Literal('ok') }),
      detail: { tags: ['Sistema'], summary: 'Verifica se o processo está de pé' },
    });
}

export type App = ReturnType<typeof criarApp>;
