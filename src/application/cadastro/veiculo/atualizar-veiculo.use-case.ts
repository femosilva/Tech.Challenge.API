import { NaoEncontradoError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { VeiculoRepository } from '@domain/cadastro/veiculo/veiculo.repository';

export class AtualizarVeiculo {
  constructor(
    private readonly veiculos: VeiculoRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar({ id, ...dados }: AtualizarVeiculo.Input): Promise<AtualizarVeiculo.Output> {
    const veiculo = await this.veiculos.buscarPorId({ id });
    if (!veiculo) throw new NaoEncontradoError('Veículo');

    veiculo.atualizar(dados);
    await this.veiculos.salvar(veiculo);
    await this.eventos.publicar(veiculo.puxarEventos());
  }
}

export namespace AtualizarVeiculo {
  /** Placa e cliente são imutáveis, por isso não aparecem aqui. */
  export type Input = Pick<Veiculo, 'id'> & Partial<Pick<Veiculo, 'marca' | 'modelo' | 'ano'>>;
  export type Output = void;
}
