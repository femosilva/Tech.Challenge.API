import { NaoEncontradoError } from '@application/core/erros';
import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { ClienteConsultas, ClienteDto } from './cliente-consultas';

export class ObterCliente {
  constructor(private readonly consultas: ClienteConsultas) {}

  async executar(input: ObterCliente.Input): Promise<ObterCliente.Output> {
    const cliente = await this.consultas.obter({ id: input.id });
    if (!cliente) throw new NaoEncontradoError('Cliente');
    return cliente;
  }
}

export namespace ObterCliente {
  export type Input = Pick<Cliente, 'id'>;
  export type Output = ClienteDto;
}
