import type { ServicoConsultas, ServicoDto } from './servico-consultas.port';

export class ListarServicos {
  constructor(private readonly consultas: ServicoConsultas) {}

  async executar(): Promise<ListarServicos.Output> {
    return this.consultas.listar();
  }
}

export namespace ListarServicos {
  export type Output = ServicoDto[];
}
