import { NaoEncontradoError } from '@application/core/erros';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { OrdemServicoConsultas, OrdemServicoDetalheDto } from '@application/ordem-servico/ordem-servico-consultas.port';

export class DetalharOrdemServico {
  constructor(private readonly consultas: OrdemServicoConsultas) {}

  async executar(input: DetalharOrdemServico.Input): Promise<DetalharOrdemServico.Output> {
    const detalhe = await this.consultas.detalhar({ id: input.id });
    if (!detalhe) throw new NaoEncontradoError('Ordem de serviço');
    return detalhe;
  }
}

export namespace DetalharOrdemServico {
  export type Input = Pick<OrdemServico, 'id'>;
  export type Output = OrdemServicoDetalheDto;
}
