import { DomainError } from "@domain/core/domain-error";
import { ValueObject } from "@domain/core/value-object";

export type StatusOSValor =
    | "RECEBIDA"
    | "EM_DIAGNOSTICO"
    | "AGUARDANDO_APROVACAO"
    | "EM_EXECUCAO"
    | "FINALIZADA"
    | "ENTREGUE";

/** Transições permitidas (quadro 5 do Miro). Qualquer outra é rejeitada. */
const TRANSICOES: Record<StatusOSValor, readonly StatusOSValor[]> = {
    RECEBIDA: ["EM_DIAGNOSTICO"],
    EM_DIAGNOSTICO: ["AGUARDANDO_APROVACAO"],
    AGUARDANDO_APROVACAO: ["EM_EXECUCAO", "EM_DIAGNOSTICO"], // aprovar | rejeitar
    EM_EXECUCAO: ["FINALIZADA"],
    FINALIZADA: ["ENTREGUE"],
    ENTREGUE: [],
};

/** Status em que ainda é permitido incluir serviços e peças. */
const ALTERA_ITENS: readonly StatusOSValor[] = ["RECEBIDA", "EM_DIAGNOSTICO"];

export class StatusOS extends ValueObject<{ valor: StatusOSValor }> {
    /** Reconstrói a partir de um texto (ex.: vindo do banco), validando. */
    static de(valor: string): StatusOS {
        if (!Object.hasOwn(TRANSICOES, valor)) {
            throw new DomainError(`Status de OS inválido: ${valor}`);
        }
        return new StatusOS({ valor: valor as StatusOSValor });
    }

    static readonly RECEBIDA = StatusOS.de("RECEBIDA");
    static readonly EM_DIAGNOSTICO = StatusOS.de("EM_DIAGNOSTICO");
    static readonly AGUARDANDO_APROVACAO = StatusOS.de("AGUARDANDO_APROVACAO");
    static readonly EM_EXECUCAO = StatusOS.de("EM_EXECUCAO");
    static readonly FINALIZADA = StatusOS.de("FINALIZADA");
    static readonly ENTREGUE = StatusOS.de("ENTREGUE");

    get valor(): StatusOSValor {
        return this.props.valor;
    }

    podeIrPara(destino: StatusOS): boolean {
        return TRANSICOES[this.valor].includes(destino.valor);
    }

    get permiteAlterarItens(): boolean {
        return ALTERA_ITENS.includes(this.valor);
    }
}
