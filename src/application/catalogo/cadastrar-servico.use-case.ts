import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import { Servico } from '@domain/catalogo/servico.aggregate';
import type { ServicoRepository } from '@domain/catalogo/servico.repository';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';

export class CadastrarServico {
  constructor(
    private readonly servicos: ServicoRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: CadastrarServico.Input): Promise<CadastrarServico.Output> {
    const servico = Servico.cadastrar({ nome: input.nome, preco: Dinheiro.deCentavos(input.precoCentavos) });

    await this.servicos.salvar(servico);
    await this.eventos.publicar(servico.puxarEventos());
    return { id: servico.id };
  }
}

export namespace CadastrarServico {
  export type Input = Pick<Servico, 'nome'> & { precoCentavos: number };
  export type Output = Pick<Servico, 'id'>;
}
