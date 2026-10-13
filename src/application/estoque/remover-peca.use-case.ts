import { ConflitoError, NaoEncontradoError } from "@application/core/erros";
import type { OrdemServicoConsultas } from "@application/ordem-servico/ordem-servico-consultas.port";
import type { Peca } from "@domain/estoque/peca.aggregate";
import type { PecaRepository } from "@domain/estoque/peca.repository";

export class RemoverPeca {
    constructor(
        private readonly pecas: PecaRepository,
        private readonly ordens: OrdemServicoConsultas,
    ) {}

    async executar(input: RemoverPeca.Input): Promise<RemoverPeca.Output> {
        const peca = await this.pecas.buscarPorId({ id: input.id });
        if (!peca) throw new NaoEncontradoError("Peça");

        if (await this.ordens.existePorPeca({ id: peca.id })) {
            throw new ConflitoError(
                "Peça já foi utilizada em ordens de serviço",
            );
        }

        await this.pecas.remover({ id: peca.id });
    }
}

export namespace RemoverPeca {
    export type Input = Pick<Peca, "id">;
    export type Output = void;
}
