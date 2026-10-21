import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { Usuario } from '@domain/identidade/usuario.aggregate';
import { PAPEIS } from '@domain/value-objects/papel.vo';
import { BunHashSenhaAdapter } from '@infrastructure/auth/bun-hash-senha.adapter';
import { UsuarioRepositoryAdapter } from '@infrastructure/persistence/identidade/usuario-repository.adapter';
import { semearUsuariosDemo, USUARIOS_DEMO } from '@infrastructure/persistence/identidade/usuarios-demo.seed';
import { limparBanco, prisma } from '../../support/banco-de-teste';

const usuarios = new UsuarioRepositoryAdapter(prisma);
const hash = new BunHashSenhaAdapter();

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('semearUsuariosDemo', () => {
  it('cria um usuário por papel, com a senha de demonstração conferindo no hash', async () => {
    expect(await semearUsuariosDemo(usuarios, hash)).toBe(3);

    expect(USUARIOS_DEMO.map((u) => u.papel).sort()).toEqual([...PAPEIS].sort());
    for (const demo of USUARIOS_DEMO) {
      const usuario = await usuarios.buscarPorEmail({ email: demo.email });
      expect(usuario?.papel).toBe(demo.papel);
      expect(usuario?.senhaHash).not.toContain(demo.senha);
      expect(await hash.comparar(demo.senha, usuario!.senhaHash)).toBe(true);
    }
  });

  it('rodar de novo não duplica nem recria: devolve zero', async () => {
    await semearUsuariosDemo(usuarios, hash);

    expect(await semearUsuariosDemo(usuarios, hash)).toBe(0);
    expect(await prisma.usuario.count()).toBe(3);
  });

  it('não sobrescreve um usuário que já existe com o mesmo e-mail', async () => {
    const existente = Usuario.criar({ email: 'admin@oficina.local', senhaHash: 'hash-do-cliente', papel: 'ADMINISTRADOR' });
    await usuarios.salvar(existente);

    expect(await semearUsuariosDemo(usuarios, hash)).toBe(2);

    expect((await usuarios.buscarPorEmail({ email: 'admin@oficina.local' }))?.senhaHash).toBe('hash-do-cliente');
  });
});
