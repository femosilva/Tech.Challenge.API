import { NaoEncontradoError } from '@application/core/erros';
import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { ClienteConsultas } from './cliente-consultas.port';
import type { VeiculoConsultas, VeiculoDto } from './veiculo-consultas.port';

export class ListarVeiculosDoCliente {
  constructor(
    private readonly clientes: ClienteConsultas,
    private readonly veiculos: VeiculoConsultas,
  ) {}

  async executar(input: ListarVeiculosDoCliente.Input): Promise<ListarVeiculosDoCliente.Output> {
    if (!(await this.clientes.obter({ id: input.clienteId }))) throw new NaoEncontradoError('Cliente');
    return this.veiculos.listarPorCliente({ clienteId: input.clienteId });
  }
}

export namespace ListarVeiculosDoCliente {
  export type Input = { clienteId: Cliente['id'] };
  export type Output = VeiculoDto[];
}
