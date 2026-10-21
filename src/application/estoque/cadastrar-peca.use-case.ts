import { ConflitoError } from "@application/core/erros";
import type { PublicadorEventos } from "@application/core/publicador-eventos.port";
import { Peca } from "@domain/estoque/peca.aggregate";
import type { PecaRepository } from "@domain/estoque/peca.repository";
import { Dinheiro } from "@domain/value-objects/dinheiro.vo";
import { Quantidade } from "@domain/value-objects/quantidade.vo";

export class CadastrarPeca {
    constructor(
        private readonly pecas: PecaRepository,
        private readonly eventos: PublicadorEventos,
    ) {}

    async executar(input: CadastrarPeca.Input): Promise<CadastrarPeca.Output> {
        const peca = Peca.cadastrar({
            codigo: input.codigo,
            nome: input.nome,
            preco: Dinheiro.deCentavos(input.precoCentavos),
            saldo:
                input.saldoInicial === undefined
                    ? undefined
                    : Quantidade.de(input.saldoInicial),
        });
        if (await this.pecas.buscarPorCodigo({ codigo: peca.codigo })) {
            throw new ConflitoError("Já existe peça com este código");
        }

        await this.pecas.salvar(peca);
        await this.eventos.publicar(peca.puxarEventos());
        return { id: peca.id };
    }
}

export namespace CadastrarPeca {
    export type Input = Pick<Peca, "codigo" | "nome"> & {
        precoCentavos: number;
        saldoInicial?: number;
    };
    export type Output = Pick<Peca, "id">;
}
