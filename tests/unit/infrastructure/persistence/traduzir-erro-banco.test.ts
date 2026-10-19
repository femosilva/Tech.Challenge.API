import { describe, expect, it } from 'bun:test';
import { ConflitoError } from '@application/core/erros';
import { Prisma } from '@infrastructure/persistence/generated/client';
import { comTraducao } from '@infrastructure/persistence/traduzir-erro-banco';

const erroPrisma = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('falha', { code, clientVersion: 'teste' });
const falhaCom = (erro: unknown) => () => Promise.reject(erro);

describe('comTraducao', () => {
  it('devolve o resultado quando não há erro', async () => {
    expect(await comTraducao({}, async () => 42)).toBe(42);
  });

  it('P2002 vira ConflitoError com a mensagem de unicidade', async () => {
    const promessa = comTraducao({ unicidade: 'duplicado' }, falhaCom(erroPrisma('P2002')));
    expect(promessa).rejects.toThrow(new ConflitoError('duplicado'));
  });

  it('P2003 vira ConflitoError com a mensagem de vínculo', async () => {
    const promessa = comTraducao({ vinculo: 'tem vínculo' }, falhaCom(erroPrisma('P2003')));
    expect(promessa).rejects.toBeInstanceOf(ConflitoError);
  });

  it('código não declarado sobe intacto (P2003 num salvar não vira conflito)', async () => {
    const original = erroPrisma('P2003');
    const promessa = comTraducao({ unicidade: 'duplicado' }, falhaCom(original));
    expect(promessa).rejects.toBe(original);
  });

  it('outros códigos e erros que não são do Prisma sobem intactos', async () => {
    const outro = erroPrisma('P2025');
    expect(comTraducao({ unicidade: 'x', vinculo: 'y' }, falhaCom(outro))).rejects.toBe(outro);
    const comum = new Error('boom');
    expect(comTraducao({ unicidade: 'x' }, falhaCom(comum))).rejects.toBe(comum);
  });
});
