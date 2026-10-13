import { NaoEncontradoError } from "@application/core/erros";
import type { PublicadorEventos } from "@application/core/publicador-eventos.port";
import type { Peca } from "@domain/estoque/peca.aggregate";
import type { PecaRepository } from "@domain/estoque/peca.repository";
import { Quantidade } from "@domain/value-objects/quantidade.vo";

export class ReporEstoque {
    constructor(
        private readonly pecas: PecaRepository,
        private readonly eventos: PublicadorEventos,
    ) {}

    async executar(input: ReporEstoque.Input): Promise<ReporEstoque.Output> {
        const peca = await this.pecas.buscarPorId({ id: input.id });
        if (!peca) throw new NaoEncontradoError("Peça");

        peca.repor(Quantidade.de(input.quantidade));
        await this.pecas.salvar(peca);
        await this.eventos.publicar(peca.puxarEventos());
    }
}

export namespace ReporEstoque {
    export type Input = Pick<Peca, "id"> & { quantidade: number };
    export type Output = void;
}
