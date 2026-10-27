import type { Autenticar } from '@application/identidade';
import type { Executa } from '@presentation/http/comum';
import { erroResposta } from '@presentation/http/erro.schema';
import { Elysia } from 'elysia';
import { loginBody, loginResposta } from './auth.schema';

export type CasosIdentidade = { autenticar: Executa<Autenticar> };

export const identidadeRoutes = ({ autenticar }: CasosIdentidade) =>
  new Elysia({ prefix: '/auth' }).post('/login', ({ body }) => autenticar.executar(body), {
    body: loginBody,
    response: { 200: loginResposta, 400: erroResposta, 401: erroResposta },
    detail: { tags: ['Autenticação'], summary: 'Autentica o usuário e devolve o token JWT' },
  });
