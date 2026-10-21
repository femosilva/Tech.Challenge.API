import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { VeiculoRepository } from '@domain/cadastro/veiculo/veiculo.repository';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';
import { comTraducao } from '@infrastructure/persistence/traduzir-erro-banco';
import * as VeiculoMapper from './veiculo.mapper';

export class VeiculoRepositoryAdapter implements VeiculoRepository {
  constructor(private readonly db: BancoDados) {}

  async buscarPorId({ id }: Pick<Veiculo, 'id'>): Promise<Veiculo | null> {
    const linha = await this.db.veiculo.findUnique({ where: { id } });
    return linha && VeiculoMapper.paraDominio(linha);
  }

  async buscarPorPlaca({ placa }: Pick<Veiculo, 'placa'>): Promise<Veiculo | null> {
    const linha = await this.db.veiculo.findUnique({ where: { placa: placa.valor } });
    return linha && VeiculoMapper.paraDominio(linha);
  }

  async salvar(veiculo: Veiculo): Promise<void> {
    const { id, ...campos } = VeiculoMapper.paraLinha(veiculo);
    await comTraducao({ unicidade: 'Já existe veículo com esta placa' }, () =>
      this.db.veiculo.upsert({ where: { id }, create: { id, ...campos }, update: campos }),
    );
  }

  async remover({ id }: Pick<Veiculo, 'id'>): Promise<void> {
    await comTraducao({ vinculo: 'Veículo possui ordens de serviço' }, () =>
      this.db.veiculo.deleteMany({ where: { id } }),
    );
  }
}
