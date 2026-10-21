import { NaoEncontradoError } from '@application/core/erros';
import type { Servico } from '@domain/catalogo/servico.aggregate';
import type { ServicoConsultas, ServicoDto } from './servico-consultas.port';

export class ObterServico {
  constructor(private readonly consultas: ServicoConsultas) {}

  async executar(input: ObterServico.Input): Promise<ObterServico.Output> {
    const servico = await this.consultas.obter({ id: input.id });
    if (!servico) throw new NaoEncontradoError('Serviço');
    return servico;
  }
}

export namespace ObterServico {
  export type Input = Pick<Servico, 'id'>;
  export type Output = ServicoDto;
}
