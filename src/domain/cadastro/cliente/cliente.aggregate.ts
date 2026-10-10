import { AggregateRoot } from "@domain/core/aggregate-root";
import { DomainError } from "@domain/core/domain-error";
import { CpfCnpj } from "@domain/shared/value-objects/cpf-cnpj.vo";
import type { ClienteEvent } from "./cliente.events";

type Dados = Pick<Cliente, "nome"> & { documento: string };

export class Cliente extends AggregateRoot<ClienteEvent> {
    private constructor(
        id: string,
        private _nome: string,
        readonly documento: CpfCnpj,
    ) {
        super(id);
    }

    static cadastrar(dados: Dados, agora = new Date()): Cliente {
        const cliente = new Cliente(
            Cliente.gerarId(),
            Cliente.normalizarNome(dados.nome),
            CpfCnpj.criar(dados.documento),
        );
        cliente.registrar({
            nome: "ClienteCadastrado",
            ocorridoEm: agora,
            clienteId: cliente.id,
        });
        return cliente;
    }

    /** Reconstrói a partir da persistência; não gera evento. */
    static restaurar(dados: Dados & Pick<Cliente, "id">): Cliente {
        return new Cliente(
            dados.id,
            dados.nome,
            CpfCnpj.criar(dados.documento),
        );
    }

    get nome(): string {
        return this._nome;
    }

    renomear(nome: string): void {
        this._nome = Cliente.normalizarNome(nome);
    }

    private static normalizarNome(nome: string): string {
        const normalizado = nome?.trim();
        if (!normalizado)
            throw new DomainError("Nome do cliente é obrigatório");
        return normalizado;
    }
}
