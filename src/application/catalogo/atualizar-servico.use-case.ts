import { NaoEncontradoError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { Servico } from '@domain/catalogo/servico.aggregate';
import type { ServicoRepository } from '@domain/catalogo/servico.repository';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';

export class AtualizarServico {
  constructor(
    private readonly servicos: ServicoRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: AtualizarServico.Input): Promise<AtualizarServico.Output> {
    const servico = await this.servicos.buscarPorId({ id: input.id });
    if (!servico) throw new NaoEncontradoError('Serviço');

    servico.atualizar({
      nome: input.nome,
      preco: input.precoCentavos === undefined ? undefined : Dinheiro.deCentavos(input.precoCentavos),
    });
    await this.servicos.salvar(servico);
    await this.eventos.publicar(servico.puxarEventos());
  }
}

export namespace AtualizarServico {
  export type Input = Pick<Servico, 'id'> & Partial<Pick<Servico, 'nome'>> & { precoCentavos?: number };
  export type Output = void;
}
