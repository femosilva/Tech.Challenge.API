import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { CredenciaisInvalidasError } from '@application/core/erros';
import { Autenticar } from '@application/identidade/autenticar.use-case';
import { BunHashSenhaAdapter } from '@infrastructure/auth/bun-hash-senha.adapter';
import { JwtProvedorTokenAdapter } from '@infrastructure/auth/jwt-provedor-token.adapter';
import { UsuarioRepositoryAdapter } from '@infrastructure/persistence/identidade/usuario-repository.adapter';
import { semearUsuariosDemo } from '@infrastructure/persistence/identidade/usuarios-demo.seed';
import { jwtVerify } from 'jose';
import { limparBanco, prisma } from '../../support/banco-de-teste';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const usuarios = new UsuarioRepositoryAdapter(prisma);
const hash = new BunHashSenhaAdapter();
const autenticar = new Autenticar(usuarios, hash, new JwtProvedorTokenAdapter({ segredo: SEGREDO, expiracao: '1h' }));

beforeAll(async () => {
  await limparBanco();
  await semearUsuariosDemo(usuarios, hash);
});
afterAll(() => prisma.$disconnect());

describe('Autenticar com os adapters reais', () => {
  it('o administrador do seed recebe um token com o id e o papel dele', async () => {
    const { token } = await autenticar.executar({ email: ' Admin@Oficina.local ', senha: 'admin123' });

    const { payload } = await jwtVerify(token, new TextEncoder().encode(SEGREDO));
    const admin = await usuarios.buscarPorEmail({ email: 'admin@oficina.local' });
    expect(payload.sub).toBe(admin!.id);
    expect(payload.papel).toBe('ADMINISTRADOR');
  });

  it('senha errada e e-mail desconhecido dão o mesmo erro', async () => {
    const senhaErrada = await autenticar.executar({ email: 'admin@oficina.local', senha: 'errada' }).catch((e: unknown) => e);
    const emailDesconhecido = await autenticar.executar({ email: 'ninguem@oficina.local', senha: 'admin123' }).catch((e: unknown) => e);

    expect(senhaErrada).toBeInstanceOf(CredenciaisInvalidasError);
    expect(emailDesconhecido).toBeInstanceOf(CredenciaisInvalidasError);
    expect((senhaErrada as Error).message).toBe((emailDesconhecido as Error).message);
  });
});
