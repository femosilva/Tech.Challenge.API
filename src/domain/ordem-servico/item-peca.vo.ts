import { DomainError } from '@domain/core/domain-error';
import { ValueObject } from '@domain/core/value-object';
import type { Dinheiro } from '@domain/shared/value-objects/dinheiro.vo';
import type { Quantidade } from '@domain/shared/value-objects/quantidade.vo';

type Props = { pecaId: string; quantidade: Quantidade; precoUnitario: Dinheiro };

export class ItemPeca extends ValueObject<Props> {
  static criar(dados: Props): ItemPeca {
    if (!dados.pecaId) throw new DomainError('Peça é obrigatória');
    if (dados.quantidade.ehZero()) throw new DomainError('Quantidade da peça deve ser maior que zero');
    return new ItemPeca({ ...dados });
  }

  get pecaId(): string { return this.props.pecaId; }
  get quantidade(): Quantidade { return this.props.quantidade; }
  get precoUnitario(): Dinheiro { return this.props.precoUnitario; }
  get total(): Dinheiro { return this.precoUnitario.multiplicar(this.quantidade.valor); }
}
