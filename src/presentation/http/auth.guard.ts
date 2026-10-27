import { ehPapel, type Papel } from '@domain/value-objects/papel.vo';
import { Elysia } from 'elysia';
import { jwtVerify } from 'jose';
import { erroResposta } from './erro.schema';
import { corpoErro } from './erros-http.plugin';

/** O guard valida com o mesmo segredo e o mesmo algoritmo com que o token foi emitido. */
export type ConfigGuardJwt = { segredo: string; algoritmo: string };

/** Usuário autenticado, entregue ao handler das rotas que declaram `papeis`. */
export type UsuarioAutenticado = { id: string; papel: Papel };

const ESQUEMA_BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Macro `papeis`: a rota declara quem pode chamá-la (`{ papeis: ['ADMINISTRADOR'] }`).
 * Sem token válido responde 401; com token de papel não permitido, 403.
 * A mesma declaração põe o cadeado (`security`) e as respostas 401 e 403 no OpenAPI.
 */
export const authGuard = ({ segredo, algoritmo }: ConfigGuardJwt) => {
  const chave = new TextEncoder().encode(segredo);

  async function autenticar(authorization: string | undefined): Promise<UsuarioAutenticado | null> {
    const token = authorization?.match(ESQUEMA_BEARER)?.[1];
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, chave, { algorithms: [algoritmo] });
      if (!payload.sub || typeof payload.papel !== 'string' || !ehPapel(payload.papel)) return null;
      return { id: payload.sub, papel: payload.papel };
    } catch {
      // assinatura inválida, token expirado, algoritmo diferente ou malformado: tudo vira 401
      return null;
    }
  }

  return new Elysia({ name: 'auth-guard' }).macro({
    papeis: (permitidos: readonly Papel[]) => ({
      detail: { security: [{ bearerAuth: [] }] },
      response: { 401: erroResposta, 403: erroResposta },
      resolve: async ({ headers, set, status }) => {
        const usuario = await autenticar(headers.authorization);
        if (!usuario) {
          set.headers['www-authenticate'] = 'Bearer';
          return status(401, corpoErro('NAO_AUTENTICADO', 'Token ausente, inválido ou expirado'));
        }
        if (!permitidos.includes(usuario.papel)) {
          return status(403, corpoErro('SEM_PERMISSAO', 'O papel do usuário não permite esta ação'));
        }
        return { usuario };
      },
    }),
  });
};

export type AuthGuard = ReturnType<typeof authGuard>;
