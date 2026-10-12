import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import type { OrdemServicoConsultas } from '@application/ordem-servico/ordem-servico-consultas.port';
import type { Servico } from '@domain/catalogo/servico.aggregate';
import type { ServicoRepository } from '@domain/catalogo/servico.repository';

export class RemoverServico {
  constructor(
    private readonly servicos: ServicoRepository,
    private readonly ordens: OrdemServicoConsultas,
  ) {}

  async executar(input: RemoverServico.Input): Promise<RemoverServico.Output> {
    const servico = await this.servicos.buscarPorId({ id: input.id });
    if (!servico) throw new NaoEncontradoError('Serviço');

    if (await this.ordens.existePorServico({ id: servico.id }))   {
      throw new ConflitoError('Serviço já foi utilizado em ordens de serviço');
    }

    await this.servicos.remover({ id: servico.id });
  }
}

export namespace RemoverServico {
  export type Input = Pick<Servico, 'id'>;
  export type Output = void;
}
