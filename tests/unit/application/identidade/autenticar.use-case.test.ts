import { beforeEach, describe, expect, test } from 'bun:test';
import { CredenciaisInvalidasError } from '@application/core/erros';
import { Autenticar } from '@application/identidade/autenticar.use-case';
import { Usuario } from '@domain/identidade/usuario.aggregate';
import { HashSenhaFalso, hashFalso } from '../doubles/hash-senha-falso';
import { ProvedorTokenFalso } from '../doubles/provedor-token-falso';
import { UsuarioRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

const falha = async (promessa: Promise<unknown>): Promise<Error> => {
  try {
    await promessa;
  } catch (erro) {
    return erro as Error;
  }
  throw new Error('Era esperado que a promessa fosse rejeitada');
};

describe('Autenticar', () => {
  let usuarios: UsuarioRepositorioEmMemoria;
  let tokens: ProvedorTokenFalso;
  let autenticar: Autenticar;
  let admin: Usuario;

  beforeEach(async () => {
    usuarios = new UsuarioRepositorioEmMemoria();
    tokens = new ProvedorTokenFalso();
    autenticar = new Autenticar(usuarios, new HashSenhaFalso(), tokens);
    admin = Usuario.criar({ email: 'admin@oficina.com', senhaHash: hashFalso('senha123'), papel: 'ADMINISTRADOR' });
    await usuarios.salvar(admin);
  });

  test('credenciais corretas devolvem o token com id e papel do usuário', async () => {
    const { token } = await autenticar.executar({ email: 'admin@oficina.com', senha: 'senha123' });

    expect(token).toBe(`token-de-${admin.id}`);
    expect(tokens.emitidos).toEqual([{ sub: admin.id, papel: 'ADMINISTRADOR' }]);
  });

  test('o e-mail é normalizado antes da busca', async () => {
    const { token } = await autenticar.executar({ email: '  ADMIN@Oficina.com ', senha: 'senha123' });
    expect(token).toBe(`token-de-${admin.id}`);
  });

  test('senha errada vira CredenciaisInvalidasError e nenhum token é emitido', async () => {
    await expect(autenticar.executar({ email: 'admin@oficina.com', senha: 'outra' })).rejects.toBeInstanceOf(
      CredenciaisInvalidasError,
    );
    expect(tokens.emitidos).toHaveLength(0);
  });

  test('e-mail desconhecido lança o mesmo erro, com a mesma mensagem', async () => {
    const porSenha = await falha(autenticar.executar({ email: 'admin@oficina.com', senha: 'x' }));
    const porEmail = await falha(autenticar.executar({ email: 'ninguem@oficina.com', senha: 'senha123' }));

    expect(porEmail).toBeInstanceOf(CredenciaisInvalidasError);
    expect(porEmail.message).toBe(porSenha.message);
    expect(tokens.emitidos).toHaveLength(0);
  });
});
