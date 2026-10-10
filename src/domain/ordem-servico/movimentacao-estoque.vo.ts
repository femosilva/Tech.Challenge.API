import { ValueObject } from '@domain/core/value-object';
import type { Quantidade } from '@domain/value-objects/quantidade.vo';

type Tipo = 'ENTRADA' | 'SAIDA';
type Props = { tipo: Tipo; quantidade: Quantidade; ocorridaEm: Date };

export class MovimentacaoEstoque extends ValueObject<Props> {
  static entrada(quantidade: Quantidade, ocorridaEm: Date): MovimentacaoEstoque {
    return new MovimentacaoEstoque({ tipo: 'ENTRADA', quantidade, ocorridaEm });
  }

  static saida(quantidade: Quantidade, ocorridaEm: Date): MovimentacaoEstoque {
    return new MovimentacaoEstoque({ tipo: 'SAIDA', quantidade, ocorridaEm });
  }

  get tipo(): Tipo { return this.props.tipo; }
  get quantidade(): Quantidade { return this.props.quantidade; }
  get ocorridaEm(): Date { return this.props.ocorridaEm; }
}
