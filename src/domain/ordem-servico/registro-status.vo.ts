import { ValueObject } from '@domain/core/value-object';
import type { StatusOS } from '@domain/value-objects/status-os.vo';

type Props = { status: StatusOS; alteradoEm: Date };

export class RegistroStatus extends ValueObject<Props> {
  static de(status: StatusOS, alteradoEm: Date): RegistroStatus {
    return new RegistroStatus({ status, alteradoEm });
  }

  get status(): StatusOS { return this.props.status; }
  get alteradoEm(): Date { return this.props.alteradoEm; }
}
