import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';
import * as ClienteMapper from './cliente.mapper';
import type { BancoDados } from '../../prisma-client';
import { comTraducao } from '../../traduzir-erro-banco';

export class ClienteRepositoryAdapter implements ClienteRepository {
  constructor(private readonly db: BancoDados) {}

  async buscarPorId({ id }: Pick<Cliente, 'id'>): Promise<Cliente | null> {
    const linha = await this.db.cliente.findUnique({ where: { id } });
    return linha && ClienteMapper.paraDominio(linha);
  }

  async buscarPorDocumento({ documento }: Pick<Cliente, 'documento'>): Promise<Cliente | null> {
    const linha = await this.db.cliente.findUnique({ where: { documento: documento.numero } });
    return linha && ClienteMapper.paraDominio(linha);
  }

  async salvar(cliente: Cliente): Promise<void> {
    const { id, ...campos } = ClienteMapper.paraLinha(cliente);
    await comTraducao({ unicidade: 'Já existe cliente com este documento' }, () =>
      this.db.cliente.upsert({ where: { id }, create: { id, ...campos }, update: campos }),
    );
  }

  async remover({ id }: Pick<Cliente, 'id'>): Promise<void> {
    await comTraducao({ vinculo: 'Cliente possui veículos ou ordens de serviço' }, () =>
      this.db.cliente.deleteMany({ where: { id } }),
    );
  }
}
