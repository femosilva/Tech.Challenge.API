import { describe, expect, it } from 'bun:test';
import { lerConfigAmbiente } from '../../src/config-ambiente';

const URL_BANCO = 'postgresql://postgres:postgres@localhost:5432/oficina';
const SEGREDO = 'x'.repeat(32);
const envValido = { DATABASE_URL: URL_BANCO, JWT_SECRET: SEGREDO };

describe('lerConfigAmbiente', () => {
  it('lê banco e JWT e usa a porta 3000 quando PORT não foi informada', () => {
    expect(lerConfigAmbiente(envValido)).toEqual({
      databaseUrl: URL_BANCO,
      porta: 3000,
      jwt: { segredo: SEGREDO, expiracao: '1h' },
    });
  });

  it('aceita a porta informada, como número', () => {
    for (const [texto, porta] of [['8080', 8080], ['1', 1], ['65535', 65535]] as const) {
      expect(lerConfigAmbiente({ ...envValido, PORT: texto }).porta).toBe(porta);
    }
  });

  it('porta fora do formato ou do intervalo falha na subida', () => {
    for (const ruim of ['', 'abc', '0', '65536', '-1', '80.5', '80a', ' 80']) {
      expect(() => lerConfigAmbiente({ ...envValido, PORT: ruim })).toThrow(`PORT inválida: "${ruim}"`);
    }
  });

  it('sem DATABASE_URL, ou com ela vazia, a aplicação não sobe', () => {
    expect(() => lerConfigAmbiente({ JWT_SECRET: SEGREDO })).toThrow('DATABASE_URL é obrigatória');
    expect(() => lerConfigAmbiente({ ...envValido, DATABASE_URL: '' })).toThrow('DATABASE_URL é obrigatória');
  });

  it('a configuração do JWT continua sendo validada (segredo ausente ou curto)', () => {
    expect(() => lerConfigAmbiente({ DATABASE_URL: URL_BANCO })).toThrow('JWT_SECRET é obrigatório');
    expect(() => lerConfigAmbiente({ ...envValido, JWT_SECRET: 'curto' })).toThrow('ao menos 32 caracteres');
  });
});
