import { NaoEncontradoError } from "@application/core/erros";
import type { PublicadorEventos } from "@application/core/publicador-eventos.port";
import type { Peca } from "@domain/estoque/peca.aggregate";
import type { PecaRepository } from "@domain/estoque/peca.repository";
import { Dinheiro } from "@domain/value-objects/dinheiro.vo";

export class AtualizarPeca {
    constructor(
        private readonly pecas: PecaRepository,
        private readonly eventos: PublicadorEventos,
    ) {}

    async executar(input: AtualizarPeca.Input): Promise<AtualizarPeca.Output> {
        const peca = await this.pecas.buscarPorId({ id: input.id });
        if (!peca) throw new NaoEncontradoError("Peça");

        peca.atualizar({
            nome: input.nome,
            preco:
                input.precoCentavos === undefined
                    ? undefined
                    : Dinheiro.deCentavos(input.precoCentavos),
        });
        await this.pecas.salvar(peca);
        await this.eventos.publicar(peca.puxarEventos());
    }
}

export namespace AtualizarPeca {
    /** O código identifica a peça e o saldo só muda por reposição ou baixa, então não aparecem aqui. */
    export type Input = Pick<Peca, "id"> &
        Partial<Pick<Peca, "nome">> & { precoCentavos?: number };
    export type Output = void;
}
