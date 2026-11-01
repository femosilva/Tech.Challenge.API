import { openapi } from '@elysiajs/openapi';
import { type CasosClientes, clientesRoutes } from '@presentation/http/cadastro/cliente.routes';
import { type CasosVeiculos, veiculosRoutes } from '@presentation/http/cadastro/veiculo.routes';
import { type CasosServicos, servicosRoutes } from '@presentation/http/catalogo/servico.routes';
import { type CasosPecas, pecasRoutes } from '@presentation/http/estoque/peca.routes';
import { type CasosIdentidade, identidadeRoutes } from '@presentation/http/identidade/auth.routes';
import {
  acompanhamentoClienteRoutes,
  type CasosAcompanhamentoCliente,
} from '@presentation/http/ordem-servico/acompanhamento-cliente.routes';
import { type CasosMetricas, metricasRoutes } from '@presentation/http/ordem-servico/metricas.routes';
import { type CasosOrdensServico, ordensServicoRoutes } from '@presentation/http/ordem-servico/ordem-servico.routes';
import { Elysia, t } from 'elysia';
import { authGuard, type ConfigGuardJwt } from './auth.guard';
import { errosHttpPlugin } from './erros-http.plugin';

/** Cresce com as rotas: cada contexto declara o que usa e entra aqui na interseção. */
export type CasosDeUso = CasosIdentidade &
  CasosClientes &
  CasosVeiculos &
  CasosServicos &
  CasosPecas &
  CasosOrdensServico &
  CasosAcompanhamentoCliente &
  CasosMetricas;

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
            { name: 'Serviços', description: 'Catálogo de serviços e preços' },
            { name: 'Peças', description: 'Peças e insumos, com controle de estoque' },
            { name: 'Ordens de Serviço', description: 'Abertura, itens, orçamento e andamento (equipe da oficina)' },
            { name: 'Acompanhamento do cliente', description: 'Rotas públicas: o cliente acompanha e decide o orçamento' },
            { name: 'Métricas', description: 'Indicadores da operação' },
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
      v1
        .use(identidadeRoutes(casos))
        .use(clientesRoutes(casos, guard))
        .use(veiculosRoutes(casos, guard))
        .use(servicosRoutes(casos, guard))
        .use(pecasRoutes(casos, guard))
        .use(ordensServicoRoutes(casos, guard))
        .use(acompanhamentoClienteRoutes(casos))
        .use(metricasRoutes(casos, guard))
    );
}

export type App = ReturnType<typeof criarApp>;
