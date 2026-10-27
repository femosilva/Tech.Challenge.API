import { describe, expect, it } from 'bun:test';
import { openapi } from '@elysiajs/openapi';
import { authGuard, type ConfigGuardJwt } from '@presentation/http/auth.guard';
import { type CorpoErro, errosHttpPlugin } from '@presentation/http/erros-http.plugin';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';

const SEGREDO = 'segredo-do-teste-com-bem-mais-de-32-caracteres';
const CONFIG: ConfigGuardJwt = { segredo: SEGREDO, algoritmo: 'HS256' };
const chaveDe = (segredo: string) => new TextEncoder().encode(segredo);

const app = new Elysia()
  .use(errosHttpPlugin())
  .use(openapi())
  .use(authGuard(CONFIG))
  .get('/livre', () => ({ ok: true }))
  .get('/admin', ({ usuario }) => usuario, { papeis: ['ADMINISTRADOR'] })
  .get('/equipe', ({ usuario }) => usuario, { papeis: ['MECANICO', 'ADMINISTRADOR'] });

type Opcoes = { papel?: string; sub?: string | null; alg?: string; segredo?: string; exp?: string | number };
function emitir({ papel, sub = 'u-1', alg = 'HS256', segredo = SEGREDO, exp = '1h' }: Opcoes = {}) {
  const jwt = new SignJWT(papel === undefined ? {} : { papel }).setProtectedHeader({ alg }).setIssuedAt().setExpirationTime(exp);
  return (sub === null ? jwt : jwt.setSubject(sub)).sign(chaveDe(segredo));
}

const chamar = (caminho: string, authorization?: string) =>
  app.handle(new Request(`http://localhost${caminho}`, { headers: authorization ? { authorization } : {} }));

const semAutenticacao: [string, () => Promise<string | undefined>][] = [
  ['sem cabeçalho Authorization', async () => undefined],
  ['esquema que não é Bearer', async () => 'Basic dXNlcjpwYXNz'],
  ['token válido sob outro esquema (Basic)', async () => `Basic ${await emitir({ papel: 'ADMINISTRADOR' })}`],
  ['Bearer sem token', async () => 'Bearer'],
  ['token malformado', async () => 'Bearer isto-nao-e-um-jwt'],
  ['assinado com outro segredo', async () => `Bearer ${await emitir({ papel: 'ADMINISTRADOR', segredo: 'outro-segredo-'.repeat(4) })}`],
  ['expirado', async () => `Bearer ${await emitir({ papel: 'ADMINISTRADOR', exp: Math.floor(Date.now() / 1000) - 60 })}`],
  ['algoritmo diferente do configurado (HS512)', async () => `Bearer ${await emitir({ papel: 'ADMINISTRADOR', alg: 'HS512' })}`],
  [
    'sem assinatura (alg none)',
    async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const exp = Math.floor(Date.now() / 1000) + 3600;
      return `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u-1', papel: 'ADMINISTRADOR', exp })}.`;
    },
  ],
  ['sem o claim sub', async () => `Bearer ${await emitir({ papel: 'ADMINISTRADOR', sub: null })}`],
  ['sem o claim papel', async () => `Bearer ${await emitir({})}`],
  ['com papel desconhecido', async () => `Bearer ${await emitir({ papel: 'SUPERUSUARIO' })}`],
];

describe('authGuard', () => {
  for (const [nome, cabecalho] of semAutenticacao) {
    it(`responde 401 no formato único de erro: ${nome}`, async () => {
      const resposta = await chamar('/admin', await cabecalho());

      expect(resposta.status).toBe(401);
      expect(resposta.headers.get('www-authenticate')).toBe('Bearer');
      expect((await resposta.json()) as CorpoErro).toEqual({
        erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Token ausente, inválido ou expirado' },
      });
    });
  }

  it('responde 403 quando o papel é válido mas não permitido, sem pedir novo login', async () => {
    const resposta = await chamar('/admin', `Bearer ${await emitir({ papel: 'ATENDENTE' })}`);

    expect(resposta.status).toBe(403);
    expect(resposta.headers.get('www-authenticate')).toBeNull();
    expect((await resposta.json()) as CorpoErro).toEqual({
      erro: { codigo: 'SEM_PERMISSAO', mensagem: 'O papel do usuário não permite esta ação' },
    });
  });

  it('entrega o usuário autenticado ao handler quando o papel é permitido', async () => {
    const resposta = await chamar('/admin', `Bearer ${await emitir({ papel: 'ADMINISTRADOR', sub: 'u-42' })}`);

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ id: 'u-42', papel: 'ADMINISTRADOR' });
  });

  it('aceita qualquer papel da lista e nega os de fora dela', async () => {
    const chamarComo = async (papel: string) => chamar('/equipe', `Bearer ${await emitir({ papel, sub: `u-${papel}` })}`);

    const mecanico = await chamarComo('MECANICO');
    const admin = await chamarComo('ADMINISTRADOR');

    expect(mecanico.status).toBe(200);
    expect(await mecanico.json()).toEqual({ id: 'u-MECANICO', papel: 'MECANICO' });
    expect(admin.status).toBe(200);
    expect(await admin.json()).toEqual({ id: 'u-ADMINISTRADOR', papel: 'ADMINISTRADOR' });
    expect((await chamarComo('ATENDENTE')).status).toBe(403);
  });

  it('o esquema Bearer não diferencia maiúsculas de minúsculas', async () => {
    const resposta = await chamar('/admin', `bearer ${await emitir({ papel: 'ADMINISTRADOR' })}`);

    expect(resposta.status).toBe(200);
  });

  it('rotas sem `papeis` continuam públicas', async () => {
    const resposta = await chamar('/livre');

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
  });

  it('põe o cadeado e as respostas 401 e 403 no OpenAPI só nas rotas protegidas', async () => {
      const resposta = await app.handle(new Request('http://localhost/openapi/json'));
      const spec = (await resposta.json()) as {
        paths: Record<string, { get: { security?: unknown; responses?: Record<string, unknown> } }>;
      };

      expect(spec.paths['/admin']!.get.security).toEqual([{ bearerAuth: [] }]);
      expect(spec.paths['/equipe']!.get.security).toEqual([{ bearerAuth: [] }]);
      expect(spec.paths['/livre']!.get.security).toBeUndefined();
      expect(Object.keys(spec.paths['/admin']!.get.responses!)).toEqual(['401', '403']);
      expect(spec.paths['/livre']!.get.responses).toBeUndefined();
    });
});
