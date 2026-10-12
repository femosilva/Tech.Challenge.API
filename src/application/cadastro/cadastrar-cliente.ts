import { ConflitoError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';

export class CadastrarCliente {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: CadastrarCliente.Input): Promise<CadastrarCliente.Output> {
    const cliente = Cliente.cadastrar(input);
    const existente = await this.clientes.buscarPorDocumento({ documento: cliente.documento });
    if (existente) throw new ConflitoError('Já existe cliente com este documento');

    await this.clientes.salvar(cliente);
    await this.eventos.publicar(cliente.puxarEventos());
    return { id: cliente.id };
  }
}

export namespace CadastrarCliente {
  export type Input = Parameters<typeof Cliente.cadastrar>[0];
  export type Output = Pick<Cliente, 'id'>;
}
