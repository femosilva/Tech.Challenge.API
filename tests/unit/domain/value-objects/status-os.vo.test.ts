import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { StatusOS } from '@domain/value-objects/status-os.vo';

describe('StatusOS', () => {
  it('permite exatamente as transições do quadro 5', () => {
    const permitidas: [StatusOS, StatusOS][] = [
      [StatusOS.RECEBIDA, StatusOS.EM_DIAGNOSTICO],
      [StatusOS.EM_DIAGNOSTICO, StatusOS.AGUARDANDO_APROVACAO],
      [StatusOS.AGUARDANDO_APROVACAO, StatusOS.EM_EXECUCAO],
      [StatusOS.AGUARDANDO_APROVACAO, StatusOS.EM_DIAGNOSTICO],
      [StatusOS.EM_EXECUCAO, StatusOS.FINALIZADA],
      [StatusOS.FINALIZADA, StatusOS.ENTREGUE],
    ];
    for (const [de, para] of permitidas) expect(de.podeIrPara(para)).toBe(true);
  });

  it('rejeita qualquer transição fora do mapa', () => {
    expect(StatusOS.RECEBIDA.podeIrPara(StatusOS.FINALIZADA)).toBe(false);
    expect(StatusOS.EM_EXECUCAO.podeIrPara(StatusOS.EM_DIAGNOSTICO)).toBe(false);
    expect(StatusOS.FINALIZADA.podeIrPara(StatusOS.RECEBIDA)).toBe(false);
    expect(StatusOS.RECEBIDA.podeIrPara(StatusOS.RECEBIDA)).toBe(false);
  });

  it('ENTREGUE é final: não vai para lugar nenhum', () => {
    for (const para of [StatusOS.RECEBIDA, StatusOS.EM_DIAGNOSTICO, StatusOS.ENTREGUE]) {
      expect(StatusOS.ENTREGUE.podeIrPara(para)).toBe(false);
    }
  });

  it('só permite alterar itens em Recebida e Em diagnóstico', () => {
    expect(StatusOS.RECEBIDA.permiteAlterarItens).toBe(true);
    expect(StatusOS.EM_DIAGNOSTICO.permiteAlterarItens).toBe(true);
    expect(StatusOS.AGUARDANDO_APROVACAO.permiteAlterarItens).toBe(false);
    expect(StatusOS.EM_EXECUCAO.permiteAlterarItens).toBe(false);
    expect(StatusOS.FINALIZADA.permiteAlterarItens).toBe(false);
    expect(StatusOS.ENTREGUE.permiteAlterarItens).toBe(false);
  });

  it('reconstrói a partir de texto e compara por valor', () => {
    expect(StatusOS.de('EM_EXECUCAO').equals(StatusOS.EM_EXECUCAO)).toBe(true);
    expect(StatusOS.de('EM_EXECUCAO').valor).toBe('EM_EXECUCAO');
  });

  it.each(['XYZ', '', 'recebida', 'toString', 'constructor'])('rejeita o texto %p', (texto) => {
    expect(() => StatusOS.de(texto)).toThrow(DomainError);
  });
});
