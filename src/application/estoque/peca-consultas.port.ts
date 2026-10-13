import type { Peca } from "@domain/estoque/peca.aggregate";

export type PecaDto = Pick<Peca, "id" | "codigo" | "nome"> & {
    precoCentavos: number;
    saldo: number;
};

export interface PecaConsultas {
    listar(): Promise<PecaDto[]>;
    obter(filtro: Pick<Peca, "id">): Promise<PecaDto | null>;
}
