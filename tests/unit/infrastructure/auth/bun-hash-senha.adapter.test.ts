import { describe, expect, it } from 'bun:test';
import { BunHashSenhaAdapter } from '@infrastructure/auth/bun-hash-senha.adapter';

const adapter = new BunHashSenhaAdapter();

describe('BunHashSenhaAdapter', () => {
  it('gera um hash argon2id que não contém a senha', async () => {
    const hash = await adapter.gerar('segredo123');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('segredo123');
  });

  it('a mesma senha gera hashes diferentes (salt), e os dois conferem', async () => {
    const [a, b] = await Promise.all([adapter.gerar('segredo123'), adapter.gerar('segredo123')]);

    expect(a).not.toBe(b);
    expect(await adapter.comparar('segredo123', a)).toBe(true);
    expect(await adapter.comparar('segredo123', b)).toBe(true);
  });

  it('senha errada não confere', async () => {
    const hash = await adapter.gerar('segredo123');

    expect(await adapter.comparar('outra-senha', hash)).toBe(false);
  });

  it('hash malformado nunca autentica e não lança', async () => {
    for (const ruim of ['nao-e-hash', '', '$argon2id$corrompido', '$2b$10$abc']) {
      expect(await adapter.comparar('segredo123', ruim)).toBe(false);
    }
  });
});
