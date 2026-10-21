import type { Peca } from '@domain/estoque/peca.aggregate';
import type { PecaRepository } from '@domain/estoque/peca.repository';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';
import { comTraducao } from '@infrastructure/persistence/traduzir-erro-banco';
import * as PecaMapper from './peca.mapper';

export class PecaRepositoryAdapter implements PecaRepository {
  /** `travar`: dentro de uma transação, `buscarPorId` segura a linha (FOR UPDATE) até o commit. */
  constructor(
      private readonly db: BancoDados,
      private readonly opcoes: { travar?: boolean } = {},
    ) {}

    async buscarPorId({ id }: Pick<Peca, 'id'>): Promise<Peca | null> {
       // trava antes de ler: o saldo lido por quem esperou o lock já inclui a baixa de quem passou antes
       if (this.opcoes.travar) await this.db.$queryRaw`SELECT 1 FROM pecas WHERE id = ${id} FOR UPDATE`;
       const linha = await this.db.peca.findUnique({ where: { id } });
       return linha && PecaMapper.paraDominio(linha);
     }

  async buscarPorCodigo({ codigo }: Pick<Peca, 'codigo'>): Promise<Peca | null> {
    const linha = await this.db.peca.findUnique({ where: { codigo } });
    return linha && PecaMapper.paraDominio(linha);
  }

  async salvar(peca: Peca): Promise<void> {
    const { id, ...campos } = PecaMapper.paraLinha(peca);
    await comTraducao({ unicidade: 'Já existe peça com este código' }, () =>
      this.db.peca.upsert({ where: { id }, create: { id, ...campos }, update: campos }),
    );
  }

  async remover({ id }: Pick<Peca, 'id'>): Promise<void> {
    await comTraducao({ vinculo: 'Peça já foi utilizada em ordens de serviço' }, () =>
      this.db.peca.deleteMany({ where: { id } }),
    );
  }
}
