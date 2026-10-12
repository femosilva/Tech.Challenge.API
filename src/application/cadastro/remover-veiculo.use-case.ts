import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import type { OrdemServicoConsultas } from '@application/ordem-servico/ordem-servico-consultas.port';
import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { VeiculoRepository } from '@domain/cadastro/veiculo/veiculo.repository';

export class RemoverVeiculo {
  constructor(
    private readonly veiculos: VeiculoRepository,
    private readonly ordens: OrdemServicoConsultas,
  ) {}

  async executar(input: RemoverVeiculo.Input): Promise<RemoverVeiculo.Output> {
    const veiculo = await this.veiculos.buscarPorId({ id: input.id });
    if (!veiculo) throw new NaoEncontradoError('Veículo');

    if (await this.ordens.existePorVeiculo({ veiculoId: veiculo.id })) {
      throw new ConflitoError('Veículo possui ordens de serviço');
    }

    await this.veiculos.remover({ id: veiculo.id });
  }
}

export namespace RemoverVeiculo {
  export type Input = Pick<Veiculo, 'id'>;
  export type Output = void;
}
