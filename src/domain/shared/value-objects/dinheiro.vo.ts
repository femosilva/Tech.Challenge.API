// shared/dinheiro.vo.ts
import { DomainError } from "../../core/domain-error";
import { ValueObject } from "../../core/value-object";

/** Valor monetário em centavos, para evitar erro de ponto flutuante. */
export class Dinheiro extends ValueObject<{ centavos: number }> {
    static deCentavos(centavos: number): Dinheiro {
        if (!Number.isInteger(centavos) || centavos < 0) {
            throw new DomainError(
                "Dinheiro deve ser um inteiro de centavos maior ou igual a zero",
            );
        }
        return new Dinheiro({ centavos });
    }

    static zero(): Dinheiro {
        return new Dinheiro({ centavos: 0 });
    }

    get centavos(): number {
        return this.props.centavos;
    }

    somar(outro: Dinheiro): Dinheiro {
        return new Dinheiro({ centavos: this.centavos + outro.centavos });
    }

    multiplicar(fator: number): Dinheiro {
        return Dinheiro.deCentavos(this.centavos * fator);
    }

    ehZero(): boolean {
        return this.centavos === 0;
    }
}
