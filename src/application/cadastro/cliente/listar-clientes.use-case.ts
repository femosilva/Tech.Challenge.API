import type { ClienteConsultas, ClienteDto } from './cliente-consultas.port';

export class ListarClientes {
  constructor(private readonly consultas: ClienteConsultas) {}

  async executar(): Promise<ListarClientes.Output> {
    return this.consultas.listar();
  }
}

export namespace ListarClientes {
  export type Output = ClienteDto[];
}
