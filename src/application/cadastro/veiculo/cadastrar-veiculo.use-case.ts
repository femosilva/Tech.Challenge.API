import { ConflitoError, ReferenciaInvalidaError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { VeiculoRepository } from '@domain/cadastro/veiculo/veiculo.repository';

export class CadastrarVeiculo {
  constructor(
    private readonly veiculos: VeiculoRepository,
    private readonly clientes: ClienteRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: CadastrarVeiculo.Input): Promise<CadastrarVeiculo.Output> {
    const veiculo = Veiculo.registrar(input);

    if (!(await this.clientes.buscarPorId({ id: veiculo.clienteId }))) {
      throw new ReferenciaInvalidaError('Cliente informado não existe');
    }
    if (await this.veiculos.buscarPorPlaca({ placa: veiculo.placa })) {
      throw new ConflitoError('Já existe veículo com esta placa');
    }

    await this.veiculos.salvar(veiculo);
    await this.eventos.publicar(veiculo.puxarEventos());
    return { id: veiculo.id };
  }
}

export namespace CadastrarVeiculo {
  export type Input = Parameters<typeof Veiculo.registrar>[0];
  export type Output = Pick<Veiculo, 'id'>;
}
