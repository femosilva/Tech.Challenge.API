import { DomainError } from "@domain/core/domain-error";
import { ValueObject } from "@domain/core/value-object";

const PESOS_CPF_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CPF_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const CPF = /^\d{11}$/;
const CNPJ = /^[A-Z0-9]{12}\d{2}$/; // 12 posições alfanuméricas + 2 dígitos verificadores

const todosIguais = (valor: string) => /^(.)\1+$/.test(valor);

/** '0'-'9' valem 0-9 e 'A'-'Z' valem 17-42 (código ASCII menos 48). */
const valorDoCaractere = (c: string) => c.charCodeAt(0) - 48;

function digitoVerificador(base: string, pesos: number[]): number {
    const soma = base
        .split("")
        .reduce((acc, c, i) => acc + valorDoCaractere(c) * pesos[i]!, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(v: string): boolean {
    if (!CPF.test(v) || todosIguais(v)) return false;
    return (
        digitoVerificador(v.slice(0, 9), PESOS_CPF_1) === Number(v[9]) &&
        digitoVerificador(v.slice(0, 10), PESOS_CPF_2) === Number(v[10])
    );
}

function cnpjValido(v: string): boolean {
    if (!CNPJ.test(v) || todosIguais(v)) return false;
    return (
        digitoVerificador(v.slice(0, 12), PESOS_CNPJ_1) === Number(v[12]) &&
        digitoVerificador(v.slice(0, 13), PESOS_CNPJ_2) === Number(v[13])
    );
}

export class CpfCnpj extends ValueObject<{ numero: string }> {
    /** Aceita com ou sem máscara e em qualquer caixa; guarda sem pontuação e em maiúsculas. */
    static criar(entrada: string): CpfCnpj {
        const numero = entrada.replace(/[.\-/\s]/g, "").toUpperCase();
        if (!cpfValido(numero) && !cnpjValido(numero)) {
            throw new DomainError("CPF ou CNPJ inválido");
        }
        return new CpfCnpj({ numero });
    }

    get numero(): string {
        return this.props.numero;
    }

    get tipo(): "CPF" | "CNPJ" {
        return this.numero.length === 11 ? "CPF" : "CNPJ";
    }
}
