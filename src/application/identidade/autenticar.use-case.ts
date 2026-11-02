import { CredenciaisInvalidasError } from '@application/core/erros';
import type { Usuario } from '@domain/identidade/usuario.aggregate';
import type { UsuarioRepository } from '@domain/identidade/usuario.repository';
import type { HashSenha } from './hash-senha.port';
import type { ProvedorToken } from './provedor-token.port';

export class Autenticar {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hash: HashSenha,
    private readonly tokens: ProvedorToken,
  ) {}

  async executar(input: Autenticar.Input): Promise<Autenticar.Output> {
    const usuario = await this.usuarios.buscarPorEmail({ email: input.email.trim().toLowerCase() });

    // Compara sempre, mesmo sem usuário: e-mail desconhecido e senha errada dão o mesmo erro e levam o mesmo tempo.
    const confere = await this.hash.comparar(input.senha, usuario?.senhaHash ?? null);
    if (!usuario || !confere) throw new CredenciaisInvalidasError();

    return { token: await this.tokens.emitir({ sub: usuario.id, papel: usuario.papel }) };
  }
}

export namespace Autenticar {
  export type Input = Pick<Usuario, 'email'> & { senha: string };
  export type Output = { token: string };
}
