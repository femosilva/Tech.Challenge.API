import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { BunHashSenhaAdapter, ALGORITMO_JWT } from '@infrastructure/auth';
import { UsuarioRepositoryAdapter } from '@infrastructure/persistence/identidade';
import { semearUsuariosDemo } from '@infrastructure/persistence/identidade/usuarios-demo.seed';
import { authGuard } from '@presentation/http/auth.guard';
import { criarApp } from '@presentation/http/criar-app';
import type { CorpoErro } from '@presentation/http/erros-http.plugin';
import { Elysia } from 'elysia';
import { jwtVerify } from 'jose';
import { compor } from '../../../src/composition-root';
import { limparBanco, prisma } from '../support/banco-de-teste';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const { prisma: prismaDaComposicao, casos, guardJwt } = compor({
  databaseUrl: process.env.TEST_DATABASE_URL!,
  jwt: { segredo: SEGREDO, expiracao: '1h' },
});
const app = criarApp(casos, guardJwt);
// rota protegida só para provar que o token emitido pelo login é aceito pelo guard
const rotaProtegida = new Elysia()
  .use(authGuard({ segredo: SEGREDO, algoritmo: ALGORITMO_JWT }))
  .get('/protegida', ({ usuario }) => usuario, { papeis: ['ADMINISTRADOR'] });

const login = (corpo: unknown) =>
  app.handle(
    new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
    }),
  );
const tokenDe = async (email: string, senha: string) => ((await (await login({ email, senha })).json()) as { token: string }).token;
const chamarProtegida = (token: string) =>
  rotaProtegida.handle(new Request('http://localhost/protegida', { headers: { authorization: `Bearer ${token}` } }));

beforeEach(async () => {
  await limparBanco();
  await semearUsuariosDemo(new UsuarioRepositoryAdapter(prisma), new BunHashSenhaAdapter());
});
afterAll(async () => {
  await prismaDaComposicao.$disconnect();
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/login (Postgres real)', () => {
  it('autentica o usuário semeado e emite um JWT com sub e papel', async () => {
    const resposta = await login({ email: 'admin@oficina.local', senha: 'admin123' });
    const { token } = (await resposta.json()) as { token: string };
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SEGREDO), { algorithms: [ALGORITMO_JWT] });
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: 'admin@oficina.local' } });

    expect(resposta.status).toBe(200);
    expect(payload.sub).toBe(usuario.id);
    expect(payload.papel).toBe('ADMINISTRADOR');
    expect(payload.exp).toBeGreaterThan(payload.iat!);
  });

  it('cada usuário de demonstração recebe o token do seu papel', async () => {
    const credenciais = [
      ['atendente@oficina.local', 'atendente123', 'ATENDENTE'],
      ['mecanico@oficina.local', 'mecanico123', 'MECANICO'],
      ['admin@oficina.local', 'admin123', 'ADMINISTRADOR'],
    ] as const;

    for (const [email, senha, papel] of credenciais) {
      const { payload } = await jwtVerify(await tokenDe(email, senha), new TextEncoder().encode(SEGREDO));
      expect(payload.papel).toBe(papel);
    }
  });

  it('aceita o e-mail com espaços e maiúsculas, como o caso de uso normaliza', async () => {
    const resposta = await login({ email: '  ADMIN@Oficina.Local ', senha: 'admin123' });

    expect(resposta.status).toBe(200);
  });

  it('senha errada e e-mail desconhecido dão 401 com o mesmo corpo', async () => {
    const senhaErrada = await login({ email: 'admin@oficina.local', senha: 'errada' });
    const desconhecido = await login({ email: 'ninguem@oficina.local', senha: 'admin123' });

    expect(senhaErrada.status).toBe(401);
    expect(desconhecido.status).toBe(401);
    expect(await senhaErrada.json()).toEqual(await desconhecido.json());
  });

  it('corpo inválido ou malformado não chega ao banco: 400', async () => {
    const semSenha = await login({ email: 'admin@oficina.local' });
    const malformado = await login('{ruim');

    expect(semSenha.status).toBe(400);
    expect(((await semSenha.json()) as CorpoErro).erro.codigo).toBe('VALIDACAO');
    expect(malformado.status).toBe(400);
    expect(((await malformado.json()) as CorpoErro).erro.codigo).toBe('CORPO_INVALIDO');
  });

  it('o token emitido pelo login é aceito pelo guard, com o mesmo algoritmo e segredo, e respeita o papel', async () => {
    const admin = await chamarProtegida(await tokenDe('admin@oficina.local', 'admin123'));
    const atendente = await chamarProtegida(await tokenDe('atendente@oficina.local', 'atendente123'));
    const usuarioAdmin = await prisma.usuario.findUniqueOrThrow({ where: { email: 'admin@oficina.local' } });

    expect(admin.status).toBe(200);
    expect(await admin.json()).toEqual({ id: usuarioAdmin.id, papel: 'ADMINISTRADOR' });
    expect(atendente.status).toBe(403);
  });
});
