import type { PecaConsultas, PecaDto } from "./peca-consultas.port";

export class ListarPecas {
    constructor(private readonly consultas: PecaConsultas) {}

    async executar(): Promise<ListarPecas.Output> {
        return this.consultas.listar();
    }
}

export namespace ListarPecas {
    export type Output = PecaDto[];
}
