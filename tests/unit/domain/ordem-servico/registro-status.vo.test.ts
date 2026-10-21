import { describe, expect, it } from 'bun:test';
import { RegistroStatus } from '@domain/ordem-servico/registro-status.vo';
import { StatusOS } from '@domain/value-objects/status-os.vo';

const agora = new Date(2026, 0, 1, 10, 0);

describe('RegistroStatus', () => {
  it('guarda o status e o instante da mudança', () => {
    const registro = RegistroStatus.de(StatusOS.EM_EXECUCAO, agora);
    expect(registro.status.equals(StatusOS.EM_EXECUCAO)).toBe(true);
    expect(registro.alteradoEm).toBe(agora);
  });

  it('compara por valor, com o instante e não a referência da data', () => {
    const a = RegistroStatus.de(StatusOS.RECEBIDA, agora);
    expect(a.equals(RegistroStatus.de(StatusOS.RECEBIDA, new Date(agora.getTime())))).toBe(true);
    expect(a.equals(RegistroStatus.de(StatusOS.EM_DIAGNOSTICO, agora))).toBe(false);
  });
});
