import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import type { OrdemServicoConsultas } from '@application/ordem-servico/ordem-servico-consultas.port';
import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';
import type { VeiculoConsultas } from './veiculo-consultas.port';

export class RemoverCliente {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly veiculos: VeiculoConsultas,
    private readonly ordens: OrdemServicoConsultas,
  ) {}

  async executar(input: RemoverCliente.Input): Promise<RemoverCliente.Output> {
    const cliente = await this.clientes.buscarPorId({ id: input.id });
    if (!cliente) throw new NaoEncontradoError('Cliente');

    const filtro = { clienteId: cliente.id };
    if (await this.veiculos.existePorCliente(filtro)) throw new ConflitoError('Cliente possui veículos');
    if (await this.ordens.existePorCliente(filtro)) throw new ConflitoError('Cliente possui ordens de serviço');

    await this.clientes.remover({ id: cliente.id });
  }
}

export namespace RemoverCliente {
  export type Input = Pick<Cliente, 'id'>;
  export type Output = void;
}
