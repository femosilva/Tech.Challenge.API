import { DomainError } from '@domain/core/domain-error';
import { ValueObject } from '@domain/core/value-object';
import type { Dinheiro } from '@domain/value-objects/dinheiro.vo';

type Props = { servicoId: string; precoUnitario: Dinheiro };

export class ItemServico extends ValueObject<Props> {
  static criar(dados: Props): ItemServico {
    if (!dados.servicoId) throw new DomainError('Serviço é obrigatório');
    return new ItemServico({ ...dados });
  }

  get servicoId(): string { return this.props.servicoId; }
  get precoUnitario(): Dinheiro { return this.props.precoUnitario; }
  get total(): Dinheiro { return this.precoUnitario; }
}
