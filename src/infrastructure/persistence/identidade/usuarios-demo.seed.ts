import type { UsuarioRepository } from '@domain/identidade/usuario.repository';
import { Usuario } from '@domain/identidade/usuario.aggregate';
import type { Papel } from '@domain/value-objects/papel.vo';
import type { BunHashSenhaAdapter } from '@infrastructure/auth/bun-hash-senha.adapter';

/** Credenciais só de demonstração (documentadas no README): um usuário por papel. */
export const USUARIOS_DEMO = [
  { email: 'atendente@oficina.local', senha: 'atendente123', papel: 'ATENDENTE' },
  { email: 'mecanico@oficina.local', senha: 'mecanico123', papel: 'MECANICO' },
  { email: 'admin@oficina.local', senha: 'admin123', papel: 'ADMINISTRADOR' },
] as const satisfies readonly { email: string; senha: string; papel: Papel }[];

/** Cria os que ainda não existem, sem mexer nos que já existem; devolve quantos criou. */
export async function semearUsuariosDemo(
  usuarios: UsuarioRepository,
  hash: Pick<BunHashSenhaAdapter, 'gerar'>,
): Promise<number> {
  let criados = 0;
  for (const demo of USUARIOS_DEMO) {
    if (await usuarios.buscarPorEmail({ email: demo.email })) continue;
    const senhaHash = await hash.gerar(demo.senha);
    await usuarios.salvar(Usuario.criar({ email: demo.email, senhaHash, papel: demo.papel }));
    criados++;
  }
  return criados;
}
