import { NaoEncontradoError, ReferenciaInvalidaError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { Peca } from '@domain/estoque/peca.aggregate';
import type { PecaRepository } from '@domain/estoque/peca.repository';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';
import { Quantidade } from '@domain/value-objects/quantidade.vo';

export class IncluirPeca {
  constructor(
    private readonly ordens: OrdemServicoRepository,
    private readonly pecas: PecaRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: IncluirPeca.Input): Promise<IncluirPeca.Output> {
    const os = await this.ordens.buscarPorId({ id: input.id });
    if (!os) throw new NaoEncontradoError('Ordem de serviço');

    const peca = await this.pecas.buscarPorId({ id: input.pecaId });
    if (!peca) throw new ReferenciaInvalidaError('Peça informada não existe');

    // Não confere o saldo aqui
    os.incluirPeca({ pecaId: peca.id, quantidade: Quantidade.de(input.quantidade), precoUnitario: peca.preco });
    await this.ordens.salvar(os);
    await this.eventos.publicar(os.puxarEventos());
  }
}

export namespace IncluirPeca {
  export type Input = Pick<OrdemServico, 'id'> & { pecaId: Peca['id']; quantidade: number };
  export type Output = void;
}
