import { ConflitoError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { UnitOfWork } from '@application/core/unit-of-work.port';
import type { DomainEvent } from '@domain/core/domain-event';
import type { Peca } from '@domain/estoque/peca.aggregate';
import { buscarOSDoCliente } from './buscar-os-do-cliente';

export class AprovarOrcamento {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: AprovarOrcamento.Input): Promise<AprovarOrcamento.Output> {
    // aprovar a OS e dar baixa em cada peça. Se algo falhar, nada é gravado.
    const eventos = await this.uow.executar(async (repos) => {
      const os = await buscarOSDoCliente(repos, input);
      os.aprovarOrcamento();

      // cada peça é carregada uma vez só: se estivesse em dois itens, o segundo salvar apagaria a primeira baixa.
      const pecas = new Map<Peca['id'], Peca>();
      for (const { pecaId } of os.itensPeca) {
        if (pecas.has(pecaId)) continue;
        const peca = await repos.pecas.buscarPorId({ id: pecaId });
        if (!peca) throw new ConflitoError('Uma peça da OS não existe mais');
        pecas.set(pecaId, peca);
      }
      for (const item of os.itensPeca) pecas.get(item.pecaId)!.darBaixa(item.quantidade);

      await repos.ordens.salvar(os);
      for (const peca of pecas.values()) await repos.pecas.salvar(peca);

      return [os, ...pecas.values()].flatMap((agregado): DomainEvent[] => agregado.puxarEventos());
    });
    await this.eventos.publicar(eventos);
  }
}

export namespace AprovarOrcamento {
  export type Input = Parameters<typeof buscarOSDoCliente>[1];
  export type Output = void;
}
