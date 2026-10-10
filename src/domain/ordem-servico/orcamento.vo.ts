import { DomainError } from '@domain/core/domain-error';
import { ValueObject } from '@domain/core/value-object';
import type { Dinheiro } from '@domain/shared/value-objects/dinheiro.vo';


type Decisao = 'PENDENTE' | 'APROVADO' | 'REJEITADO';
type Props = { total: Dinheiro; geradoEm: Date; enviado: boolean; decisao: Decisao };

export class Orcamento extends ValueObject<Props> {
  static gerar(total: Dinheiro, geradoEm: Date): Orcamento {
    return new Orcamento({ total, geradoEm, enviado: false, decisao: 'PENDENTE' });
  }

  get total(): Dinheiro { return this.props.total; }
  get geradoEm(): Date { return this.props.geradoEm; }
  get enviado(): boolean { return this.props.enviado; }
  get decisao(): Decisao { return this.props.decisao; }

  enviar(): Orcamento {
    if (this.enviado) throw new DomainError('Orçamento já foi enviado');
    return new Orcamento({ ...this.props, enviado: true });
  }

  aprovar(): Orcamento {
    this.exigirEnviadoEPendente();
    return new Orcamento({ ...this.props, decisao: 'APROVADO' });
  }

  rejeitar(): Orcamento {
    this.exigirEnviadoEPendente();
    return new Orcamento({ ...this.props, decisao: 'REJEITADO' });
  }

  private exigirEnviadoEPendente(): void {
    if (!this.enviado) throw new DomainError('Orçamento ainda não foi enviado ao cliente');
    if (this.decisao !== 'PENDENTE') throw new DomainError('Orçamento já foi decidido');
  }
}
