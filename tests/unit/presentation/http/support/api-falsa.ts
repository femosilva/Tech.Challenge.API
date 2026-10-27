import { mock } from 'bun:test';
import type { ConfigGuardJwt } from '@presentation/http/auth.guard';
import { type CasosDeUso, criarApp } from '@presentation/http/criar-app';
import { criarRequisitor } from '../../../../integration/support/http';

export const JWT_DE_TESTE: ConfigGuardJwt = { segredo: 'segredo-do-teste-com-bem-mais-de-32-caracteres', algoritmo: 'HS256' };

export const CLIENTE = { id: 'c-1', nome: 'Ana Souza', documento: '52998224725' };
export const VEICULO = { id: 'v-1', clienteId: 'c-1', placa: 'ABC1D23', marca: 'Volkswagen', modelo: 'Gol', ano: 2020 };

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
  } satisfies CasosDeUso;
}

export function criarApiFalsa() {
  const casos = criarCasosFalsos();
  const app = criarApp(casos, JWT_DE_TESTE);
  return { app, casos, requisitar: criarRequisitor(app, JWT_DE_TESTE) };
}
