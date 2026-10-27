import { openapi } from '@elysiajs/openapi';
import { type CasosClientes, clientesRoutes } from '@presentation/http/cadastro/cliente.routes';
import { type CasosVeiculos, veiculosRoutes } from '@presentation/http/cadastro/veiculo.routes';
import { type CasosIdentidade, identidadeRoutes } from '@presentation/http/identidade/auth.routes';
import { Elysia, t } from 'elysia';
import { authGuard, type ConfigGuardJwt } from './auth.guard';
import { errosHttpPlugin } from './erros-http.plugin';

/** Cresce com as rotas: cada contexto declara o que usa e entra aqui na interseção. */
export type CasosDeUso = CasosIdentidade & CasosClientes & CasosVeiculos;

export function criarApp(casos: CasosDeUso, jwt: ConfigGuardJwt) {
  const guard = authGuard(jwt);

  // normalize: false = corpo com campo desconhecido é rejeitado (400) em vez de ignorado em silêncio,
  // e resposta fora do contrato vira erro em vez de passar.
  return new Elysia({ normalize: false })
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
            { name: 'Clientes', description: 'Cadastro de clientes e consulta dos seus veículos' },
            { name: 'Veículos', description: 'Cadastro de veículos' },
          ],
          components: {
            securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
          },
        },
      }),
    )
    // Só liveness: não consulta o banco (isso exigiria uma porta na Application).
    .get('/health', () => ({ status: 'ok' as const }), {
      response: t.Object({ status: t.Literal('ok') }),
      detail: { tags: ['Sistema'], summary: 'Verifica se o processo está de pé' },
    })
    .group('/api/v1', (v1) =>
      v1.use(identidadeRoutes(casos)).use(clientesRoutes(casos, guard)).use(veiculosRoutes(casos, guard)),
    );
}

export type App = ReturnType<typeof criarApp>;
