import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';
import { buscarOSDoCliente } from './buscar-os-do-cliente';

export class RejeitarOrcamento {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly ordens: OrdemServicoRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: RejeitarOrcamento.Input): Promise<RejeitarOrcamento.Output> {
    const os = await buscarOSDoCliente({ clientes: this.clientes, ordens: this.ordens }, input);

    os.rejeitarOrcamento();
    await this.ordens.salvar(os);
    await this.eventos.publicar(os.puxarEventos());
  }
}

export namespace RejeitarOrcamento {
  export type Input = Parameters<typeof buscarOSDoCliente>[1];
  export type Output = void;
}
