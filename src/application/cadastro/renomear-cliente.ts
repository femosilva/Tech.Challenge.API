import { NaoEncontradoError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos';
import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';

export class RenomearCliente {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: RenomearCliente.Input): Promise<RenomearCliente.Output> {
    const cliente = await this.clientes.buscarPorId({ id: input.id });
    if (!cliente) throw new NaoEncontradoError('Cliente');

    cliente.renomear(input.nome);
    await this.clientes.salvar(cliente);
    await this.eventos.publicar(cliente.puxarEventos());
  }
}

export namespace RenomearCliente {
  export type Input = Pick<Cliente, 'id' | 'nome'>;
  export type Output = void;
}
