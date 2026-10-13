import { NaoEncontradoError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';

export class EntregarVeiculo {
  constructor(
    private readonly ordens: OrdemServicoRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: EntregarVeiculo.Input): Promise<EntregarVeiculo.Output> {
    const os = await this.ordens.buscarPorId({ id: input.id });
    if (!os) throw new NaoEncontradoError('Ordem de serviço');

    os.entregar();
    await this.ordens.salvar(os);
    await this.eventos.publicar(os.puxarEventos());
  }
}

export namespace EntregarVeiculo {
  export type Input = Pick<OrdemServico, 'id'>;
  export type Output = void;
}
