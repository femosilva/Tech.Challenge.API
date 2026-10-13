import { NaoEncontradoError, ReferenciaInvalidaError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { Servico } from '@domain/catalogo/servico.aggregate';
import type { ServicoRepository } from '@domain/catalogo/servico.repository';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';

export class IncluirServico {
  constructor(
    private readonly ordens: OrdemServicoRepository,
    private readonly servicos: ServicoRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: IncluirServico.Input): Promise<IncluirServico.Output> {
    const os = await this.ordens.buscarPorId({ id: input.id });
    if (!os) throw new NaoEncontradoError('Ordem de serviço');

    const servico = await this.servicos.buscarPorId({ id: input.servicoId });
    if (!servico) throw new ReferenciaInvalidaError('Serviço informado não existe');

    // O preço do catálogo vale no momento da inclusão; mudanças posteriores não alteram a OS.
    os.incluirServico({ servicoId: servico.id, precoUnitario: servico.preco });
    await this.ordens.salvar(os);
    await this.eventos.publicar(os.puxarEventos());
  }
}

export namespace IncluirServico {
  export type Input = Pick<OrdemServico, 'id'> & { servicoId: Servico['id'] };
  export type Output = void;
}
