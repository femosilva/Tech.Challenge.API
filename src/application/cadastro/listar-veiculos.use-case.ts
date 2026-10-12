import type { VeiculoConsultas, VeiculoDto } from './veiculo-consultas.port';

export class ListarVeiculos {
  constructor(private readonly consultas: VeiculoConsultas) {}

  async executar(): Promise<ListarVeiculos.Output> {
    return this.consultas.listar();
  }
}

export namespace ListarVeiculos {
  export type Output = VeiculoDto[];
}
