import type { Servico } from '@domain/catalogo/servico.aggregate';
import type { ServicoRepository } from '@domain/catalogo/servico.repository';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';
import { comTraducao } from '@infrastructure/persistence/traduzir-erro-banco';
import * as ServicoMapper from './servico.mapper';

export class ServicoRepositoryAdapter implements ServicoRepository {
  constructor(private readonly db: BancoDados) {}

  async buscarPorId({ id }: Pick<Servico, 'id'>): Promise<Servico | null> {
    const linha = await this.db.servico.findUnique({ where: { id } });
    return linha && ServicoMapper.paraDominio(linha);
  }

  async salvar(servico: Servico): Promise<void> {
    const { id, ...campos } = ServicoMapper.paraLinha(servico);
    await this.db.servico.upsert({ where: { id }, create: { id, ...campos }, update: campos });
  }

  async remover({ id }: Pick<Servico, 'id'>): Promise<void> {
    await comTraducao({ vinculo: 'Serviço já foi utilizado em ordens de serviço' }, () =>
      this.db.servico.deleteMany({ where: { id } }),
    );
  }
}
