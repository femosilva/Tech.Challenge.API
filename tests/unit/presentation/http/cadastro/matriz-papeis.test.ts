import { describe, expect, it } from 'bun:test';
import type { Papel } from '@domain/value-objects/papel.vo';
import { authGuard } from '@presentation/http/auth.guard';
import { clientesRoutes } from '@presentation/http/cadastro/cliente.routes';
import { veiculosRoutes } from '@presentation/http/cadastro/veiculo.routes';
import { Elysia } from 'elysia';
import { criarRequisitor } from '../../../../integration/support/http';
import { criarApiFalsa, criarCasosFalsos, JWT_DE_TESTE } from '../support/api-falsa';

// A matriz está escrita por extenso de propósito: se alguém mexer em papeis.ts, este teste acusa.
const TODOS: readonly Papel[] = ['ATENDENTE', 'MECANICO', 'ADMINISTRADOR'];
const CONSULTA: readonly Papel[] = ['ATENDENTE', 'MECANICO', 'ADMINISTRADOR'];
const BALCAO: readonly Papel[] = ['ATENDENTE', 'ADMINISTRADOR'];
const SO_ADMIN: readonly Papel[] = ['ADMINISTRADOR'];

const CLIENTE_NOVO = { nome: 'Ana Souza', documento: '529.982.247-25' };
const VEICULO_NOVO = { clienteId: 'c-1', placa: 'ABC1D23', marca: 'Volkswagen', modelo: 'Gol', ano: 2020 };

type Linha = { metodo: string; caminho: string; corpo?: unknown; ok: number; permitidos: readonly Papel[] };
const MATRIZ: Linha[] = [
  { metodo: 'POST', caminho: '/api/v1/clientes', corpo: CLIENTE_NOVO, ok: 201, permitidos: BALCAO },
  { metodo: 'GET', caminho: '/api/v1/clientes', ok: 200, permitidos: CONSULTA },
  { metodo: 'GET', caminho: '/api/v1/clientes/c-1', ok: 200, permitidos: CONSULTA },
  { metodo: 'PATCH', caminho: '/api/v1/clientes/c-1', corpo: { nome: 'Ana' }, ok: 204, permitidos: BALCAO },
  { metodo: 'DELETE', caminho: '/api/v1/clientes/c-1', ok: 204, permitidos: SO_ADMIN },
  { metodo: 'GET', caminho: '/api/v1/clientes/c-1/veiculos', ok: 200, permitidos: CONSULTA },
  { metodo: 'POST', caminho: '/api/v1/veiculos', corpo: VEICULO_NOVO, ok: 201, permitidos: BALCAO },
  { metodo: 'GET', caminho: '/api/v1/veiculos', ok: 200, permitidos: CONSULTA },
  { metodo: 'GET', caminho: '/api/v1/veiculos/v-1', ok: 200, permitidos: CONSULTA },
  { metodo: 'PATCH', caminho: '/api/v1/veiculos/v-1', corpo: { marca: 'Fiat' }, ok: 204, permitidos: BALCAO },
  { metodo: 'DELETE', caminho: '/api/v1/veiculos/v-1', ok: 204, permitidos: SO_ADMIN },
];

describe('matriz de papéis do cadastro', () => {
  for (const { metodo, caminho, corpo, ok, permitidos } of MATRIZ) {
    it(`${metodo} ${caminho}: ${permitidos.join(', ')}`, async () => {
      const { requisitar, casos } = criarApiFalsa();

      // sem token: 401; papel fora da lista: 403. Em nenhum dos dois o caso de uso chega a rodar.
      const semAcesso: (Papel | undefined)[] = [undefined, ...TODOS.filter((papel) => !permitidos.includes(papel))];
      for (const papel of semAcesso) {
        const resposta = await requisitar(metodo, caminho, { papel, corpo });
        expect([papel ?? 'sem token', resposta.status]).toEqual([papel ?? 'sem token', papel ? 403 : 401]);
      }
      for (const caso of Object.values(casos)) expect(caso.executar).not.toHaveBeenCalled();

      for (const papel of permitidos) {
        const resposta = await requisitar(metodo, caminho, { papel, corpo });
        expect([papel, resposta.status]).toEqual([papel, ok]);
      }
    });
  }
});

// A macro `papeis` fica registrada no app inteiro assim que UM plugin faz `.use(guard)`. Por isso um plugin que
// esquecesse o `.use(guard)` continuaria protegido só pela ordem de montagem, e a opção `papeis` seria ignorada
// em silêncio (rotas abertas) se ele viesse antes. Cada plugin de rotas tem de se proteger sozinho.
describe('cada plugin de rotas se protege sozinho, sem depender da ordem de montagem', () => {
  const plugins: { nome: string; montar: (casos: ReturnType<typeof criarCasosFalsos>, guard: ReturnType<typeof authGuard>) => Elysia<any, any, any, any, any, any, any>; prefixo: string }[] = [
    { nome: 'clientes', montar: (casos, guard) => clientesRoutes(casos, guard), prefixo: '/api/v1/clientes' },
    { nome: 'veículos', montar: (casos, guard) => veiculosRoutes(casos, guard), prefixo: '/api/v1/veiculos' },
  ];

  for (const { nome, montar, prefixo } of plugins) {
    it(`${nome}: sem token, todas as rotas respondem 401 e nenhum caso de uso roda`, async () => {
      const casos = criarCasosFalsos(); // um conjunto por teste: um plugin aberto não contamina o outro
      const app = new Elysia({ normalize: false }).group('/api/v1', (v1) => v1.use(montar(casos, authGuard(JWT_DE_TESTE))));
      const requisitar = criarRequisitor(app, JWT_DE_TESTE);
      const rotas = MATRIZ.filter((linha) => linha.caminho.startsWith(prefixo));

      expect(rotas.length).toBeGreaterThan(0);
      for (const { metodo, caminho, corpo } of rotas) {
        const resposta = await requisitar(metodo, caminho, { corpo });
        expect([metodo, caminho, resposta.status]).toEqual([metodo, caminho, 401]);
      }
      for (const caso of Object.values(casos)) expect(caso.executar).not.toHaveBeenCalled();
    });
  }
});
