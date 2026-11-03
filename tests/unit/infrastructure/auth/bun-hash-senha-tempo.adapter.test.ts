import { describe, expect, it } from 'bun:test';
import { BunHashSenhaAdapter } from '@infrastructure/auth/bun-hash-senha.adapter';

const mediana = (valores: number[]) => [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)]!;
async function medir(operacao: () => Promise<unknown>, vezes: number) {
  const tempos: number[] = [];
  for (let i = 0; i < vezes; i++) {
    const inicio = performance.now();
    await operacao();
    tempos.push(performance.now() - inicio);
  }
  return mediana(tempos);
}

describe('BunHashSenhaAdapter: hash nulo (usuário inexistente)', () => {
  it('nunca autentica, qualquer que seja a senha', async () => {
    const adapter = new BunHashSenhaAdapter();

    expect(await adapter.comparar('segredo123', null)).toBe(false);
    expect(await adapter.comparar('', null)).toBe(false);
  });

  it('a senha certa de um usuário real continua conferindo depois de comparações com hash nulo', async () => {
    const adapter = new BunHashSenhaAdapter();
    const hash = await adapter.gerar('segredo123');

    await adapter.comparar('segredo123', null);

    expect(await adapter.comparar('segredo123', hash)).toBe(true);
  });

  it('leva o mesmo tempo de uma verificação real: o tempo não revela quais e-mails existem', async () => {
    const adapter = new BunHashSenhaAdapter();
    const hash = await adapter.gerar('segredo123');
    await adapter.comparar('x', null); // aquecimento: o hash de referência já existe

    const semUsuario = await medir(() => adapter.comparar('errada', null), 5);
    const comUsuario = await medir(() => adapter.comparar('errada', hash), 5);

    // Antes da correção a resposta sem usuário levava ~1% do tempo da outra. O limite é folgado de propósito.
    expect(semUsuario / comUsuario).toBeGreaterThan(0.5);
    expect(semUsuario / comUsuario).toBeLessThan(2);
  });
});
