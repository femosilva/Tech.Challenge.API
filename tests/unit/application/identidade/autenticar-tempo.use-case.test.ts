import { describe, expect, test } from 'bun:test';
import { CredenciaisInvalidasError } from '@application/core/erros';
import { Autenticar } from '@application/identidade/autenticar.use-case';
import { Usuario } from '@domain/identidade/usuario.aggregate';
import { HashSenhaFalso, hashFalso } from '../doubles/hash-senha-falso';
import { ProvedorTokenFalso } from '../doubles/provedor-token-falso';
import { UsuarioRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

/**
 * O tempo da resposta não pode revelar quais e-mails existem: sem usuário, o caso de uso ainda assim
 * pede a comparação de hash (o adapter gasta o mesmo tempo de uma verificação real).
 */
describe('Autenticar: mesmo trabalho com e sem usuário', () => {
  async function montar() {
    const usuarios = new UsuarioRepositorioEmMemoria();
    const hash = new HashSenhaFalso();
    const admin = Usuario.criar({ email: 'admin@oficina.com', senhaHash: hashFalso('senha123'), papel: 'ADMINISTRADOR' });
    await usuarios.salvar(admin);
    return { hash, autenticar: new Autenticar(usuarios, hash, new ProvedorTokenFalso()), admin };
  }

  test('e-mail desconhecido também passa pela comparação de hash, com hash nulo', async () => {
    const { hash, autenticar } = await montar();

    await expect(autenticar.executar({ email: 'ninguem@oficina.com', senha: 'senha123' })).rejects.toBeInstanceOf(
      CredenciaisInvalidasError,
    );

    expect(hash.hashesComparados).toEqual([null]);
  });

  test('e-mail conhecido compara com o hash do usuário, e só com ele', async () => {
    const { hash, autenticar } = await montar();

    await expect(autenticar.executar({ email: 'admin@oficina.com', senha: 'errada' })).rejects.toBeInstanceOf(
      CredenciaisInvalidasError,
    );
    await autenticar.executar({ email: 'admin@oficina.com', senha: 'senha123' });

    expect(hash.hashesComparados).toEqual([hashFalso('senha123'), hashFalso('senha123')]);
  });

  test('uma comparação com hash nulo nunca autentica, nem com a senha "certa" de outro usuário', async () => {
    const { autenticar } = await montar();

    await expect(autenticar.executar({ email: 'ninguem@oficina.com', senha: 'senha123' })).rejects.toBeInstanceOf(
      CredenciaisInvalidasError,
    );
  });
});
