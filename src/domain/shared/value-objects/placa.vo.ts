// cadastro/veiculo/placa.vo.ts
import { DomainError } from "../../core/domain-error";
import { ValueObject } from "../../core/value-object";

const PADRAO_ANTIGO = /^[A-Z]{3}\d{4}$/;
const PADRAO_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

export class Placa extends ValueObject<{ valor: string }> {
    static criar(entrada: string): Placa {
        const valor = entrada.replace(/[\s-]/g, "").toUpperCase();
        if (!PADRAO_ANTIGO.test(valor) && !PADRAO_MERCOSUL.test(valor)) {
            throw new DomainError("Placa inválida");
        }
        return new Placa({ valor });
    }

    get valor(): string {
        return this.props.valor;
    }
}
