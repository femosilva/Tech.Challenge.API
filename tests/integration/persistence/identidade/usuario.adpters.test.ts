import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { ConflitoError } from '@application/core/erros';
import { Usuario } from '@domain/identidade/usuario.aggregate';
import { UsuarioRepositoryAdapter } from '@infrastructure/persistence/identidade/usuario-repository.adapter';
import { limparBanco, prisma } from '../../support/banco-de-teste';

const repo = new UsuarioRepositoryAdapter(prisma);

const novoUsuario = (email = 'admin@oficina.com') => Usuario.criar({ email, senhaHash: 'hash', papel: 'ADMINISTRADOR' });

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('UsuarioRepositoryAdapter', () => {
  it('salva e restaura o usuário com o papel validado', async () => {
    const usuario = novoUsuario();
    await repo.salvar(usuario);

    const lido = await repo.buscarPorId({ id: usuario.id });
    expect(lido?.equals(usuario)).toBe(true);
    expect([lido?.email, lido?.senhaHash, lido?.papel]).toEqual(['admin@oficina.com', 'hash', 'ADMINISTRADOR']);
    expect(await repo.buscarPorId({ id: 'inexistente' })).toBeNull();
  });

  it('salvar de novo atualiza em vez de duplicar', async () => {
    const usuario = novoUsuario();
    await repo.salvar(usuario);
    await repo.salvar(usuario);

    expect(await prisma.usuario.count()).toBe(1);
  });

  it('busca por e-mail e devolve null quando não existe', async () => {
    const usuario = novoUsuario();
    await repo.salvar(usuario);

    expect((await repo.buscarPorEmail({ email: 'admin@oficina.com' }))?.id).toBe(usuario.id);
    expect(await repo.buscarPorEmail({ email: 'outro@oficina.com' })).toBeNull();
  });

  it('e-mail repetido (corrida entre duas requisições) vira ConflitoError', async () => {
    await repo.salvar(novoUsuario());

    expect(repo.salvar(novoUsuario())).rejects.toThrow(new ConflitoError('Já existe usuário com este e-mail'));
  });
});
