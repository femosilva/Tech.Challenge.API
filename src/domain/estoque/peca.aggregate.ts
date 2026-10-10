import { AggregateRoot } from '@domain/core/aggregate-root';
import { DomainError } from '@domain/core/domain-error';
import type { Dinheiro } from '@domain/shared/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/shared/value-objects/quantidade.vo';
import type { PecaEvent } from './peca.events';

type Dados = Pick<Peca, 'codigo' | 'nome' | 'preco'>;

/** Peça ou insumo: a linguagem ubíqua trata os dois como o mesmo conceito. */
export class Peca extends AggregateRoot<PecaEvent> {
  private constructor(
    id: string,
    readonly codigo: string,
    private _nome: string,
    private _preco: Dinheiro,
    private _saldo: Quantidade,
  ) {
    super(id);
  }

  static cadastrar(dados: Dados & Partial<Pick<Peca, 'saldo'>>, agora = new Date()): Peca {
    const peca = new Peca(
      Peca.gerarId(),
      Peca.textoValido(dados.codigo, 'Código da peça é obrigatório'),
      Peca.textoValido(dados.nome, 'Nome da peça é obrigatório'),
      dados.preco,
      Quantidade.zero(),
    );
    peca.registrar({ nome: 'PecaCadastrada', ocorridoEm: agora, pecaId: peca.id });
    if (dados.saldo && !dados.saldo.ehZero()) peca.repor(dados.saldo, agora);
    return peca;
  }

  /** Reconstrói a partir da persistência; não gera evento. */
  static restaurar(dados: Dados & Pick<Peca, 'id' | 'saldo'>): Peca {
    return new Peca(dados.id, dados.codigo, dados.nome, dados.preco, dados.saldo);
  }

  get nome(): string {
    return this._nome;
  }

  get preco(): Dinheiro {
    return this._preco;
  }

  get saldo(): Quantidade {
    return this._saldo;
  }

  /** O código identifica a peça no estoque e não muda. */
  atualizar(dados: Partial<Pick<Peca, 'nome' | 'preco'>>): void {
    const nome = Peca.textoValido(dados.nome ?? this._nome, 'Nome da peça é obrigatório');
    this._nome = nome;
    this._preco = dados.preco ?? this._preco;
  }

  repor(quantidade: Quantidade, agora = new Date()): void {
    if (quantidade.ehZero()) throw new DomainError('Quantidade de reposição deve ser maior que zero');
    this._saldo = this._saldo.somar(quantidade);
    this.registrar({
      nome: 'EstoqueReposto',
      ocorridoEm: agora,
      pecaId: this.id,
      quantidade: quantidade.valor,
    });
  }

  /** Invariante: o saldo nunca fica negativo. */
  darBaixa(quantidade: Quantidade, agora = new Date()): void {
    if (quantidade.ehZero()) throw new DomainError('Quantidade de baixa deve ser maior que zero');
    if (quantidade.maiorQue(this._saldo)) {
      throw new DomainError(`Saldo insuficiente da peça ${this.codigo}`);
    }
    this._saldo = this._saldo.subtrair(quantidade);
    this.registrar({
      nome: 'EstoqueBaixado',
      ocorridoEm: agora,
      pecaId: this.id,
      quantidade: quantidade.valor,
    });
  }

  private static textoValido(valor: string, mensagem: string): string {
    const normalizado = valor?.trim();
    if (!normalizado) throw new DomainError(mensagem);
    return normalizado;
  }
}
