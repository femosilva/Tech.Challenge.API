import type { Usuario } from '@domain/identidade/usuario.aggregate';
import type { UsuarioRepository } from '@domain/identidade/usuario.repository';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';
import { comTraducao } from '@infrastructure/persistence/traduzir-erro-banco';
import * as UsuarioMapper from './usuario.mapper';

export class UsuarioRepositoryAdapter implements UsuarioRepository {
  constructor(private readonly db: BancoDados) {}

  async buscarPorId({ id }: Pick<Usuario, 'id'>): Promise<Usuario | null> {
    const linha = await this.db.usuario.findUnique({ where: { id } });
    return linha && UsuarioMapper.paraDominio(linha);
  }

  async buscarPorEmail({ email }: Pick<Usuario, 'email'>): Promise<Usuario | null> {
    const linha = await this.db.usuario.findUnique({ where: { email } });
    return linha && UsuarioMapper.paraDominio(linha);
  }

  async salvar(usuario: Usuario): Promise<void> {
    const { id, ...campos } = UsuarioMapper.paraLinha(usuario);
    await comTraducao({ unicidade: 'Já existe usuário com este e-mail' }, () =>
      this.db.usuario.upsert({ where: { id }, create: { id, ...campos }, update: campos }),
    );
  }
}
