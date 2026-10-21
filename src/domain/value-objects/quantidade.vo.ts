import { DomainError } from "@domain/core/domain-error";
import { ValueObject } from "@domain/core/value-object";
/** Quantidade inteira e nunca negativa. */
export class Quantidade extends ValueObject<{ valor: number }> {
    static de(valor: number): Quantidade {
        if (!Number.isInteger(valor) || valor < 0) {
            throw new DomainError(
                "Quantidade deve ser um inteiro maior ou igual a zero",
            );
        }
        return new Quantidade({ valor });
    }

    static zero(): Quantidade {
        return new Quantidade({ valor: 0 });
    }

    get valor(): number {
        return this.props.valor;
    }

    somar(outra: Quantidade): Quantidade {
        return new Quantidade({ valor: this.valor + outra.valor });
    }

    subtrair(outra: Quantidade): Quantidade {
        if (outra.valor > this.valor)
            throw new DomainError("Quantidade insuficiente");
        return new Quantidade({ valor: this.valor - outra.valor });
    }

    ehZero(): boolean {
        return this.valor === 0;
    }

    maiorQue(outra: Quantidade): boolean {
        return this.valor > outra.valor;
    }
}
