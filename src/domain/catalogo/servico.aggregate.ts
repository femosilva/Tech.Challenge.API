import { AggregateRoot } from '@domain/core/aggregate-root';
import { DomainError } from '@domain/core/domain-error';
import type { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import type { ServicoEvent } from './servico.events';

type Dados = Pick<Servico, 'nome' | 'preco'>;

export class Servico extends AggregateRoot<ServicoEvent> {
  private constructor(
    id: string,
    private _nome: string,
    private _preco: Dinheiro,
  ) {
    super(id);
  }

  static cadastrar(dados: Dados, agora = new Date()): Servico {
    const servico = new Servico(
      Servico.gerarId(),
      Servico.nomeValido(dados.nome),
      Servico.precoValido(dados.preco),
    );
    servico.registrar({ nome: 'ServicoCadastrado', ocorridoEm: agora, servicoId: servico.id });
    return servico;
  }

  /** Reconstrói a partir da persistência; não gera evento. */
  static restaurar(dados: Dados & Pick<Servico, 'id'>): Servico {
    return new Servico(dados.id, dados.nome, dados.preco);
  }

  get nome(): string {
    return this._nome;
  }

  get preco(): Dinheiro {
    return this._preco;
  }

  /** Valida tudo antes de alterar qualquer campo. */
  atualizar(dados: Partial<Dados>): void {
    const nome = Servico.nomeValido(dados.nome ?? this._nome);
    const preco = Servico.precoValido(dados.preco ?? this._preco);
    this._nome = nome;
    this._preco = preco;
  }

  private static nomeValido(nome: string): string {
    const normalizado = nome?.trim();
    if (!normalizado) throw new DomainError('Nome do serviço é obrigatório');
    return normalizado;
  }

  private static precoValido(preco: Dinheiro): Dinheiro {
    if (preco.ehZero()) throw new DomainError('Preço do serviço deve ser maior que zero');
    return preco;
  }
}
