import { NaoEncontradoError } from "@application/core/erros";
import type { Peca } from "@domain/estoque/peca.aggregate";
import type { PecaConsultas, PecaDto } from "./peca-consultas.port";

export class ObterPeca {
    constructor(private readonly consultas: PecaConsultas) {}

    async executar(input: ObterPeca.Input): Promise<ObterPeca.Output> {
        const peca = await this.consultas.obter({ id: input.id });
        if (!peca) throw new NaoEncontradoError("Peça");
        return peca;
    }
}

export namespace ObterPeca {
    export type Input = Pick<Peca, "id">;
    export type Output = PecaDto;
}
