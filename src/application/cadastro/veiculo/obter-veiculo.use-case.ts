import { NaoEncontradoError } from '@application/core/erros';
import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { VeiculoConsultas, VeiculoDto } from './veiculo-consultas.port';

export class ObterVeiculo {
  constructor(private readonly consultas: VeiculoConsultas) {}

  async executar(input: ObterVeiculo.Input): Promise<ObterVeiculo.Output> {
    const veiculo = await this.consultas.obter({ id: input.id });
    if (!veiculo) throw new NaoEncontradoError('Veículo');
    return veiculo;
  }
}

export namespace ObterVeiculo {
  export type Input = Pick<Veiculo, 'id'>;
  export type Output = VeiculoDto;
}
