import { describe, expect, it } from 'bun:test';
import { lerConfigJwt } from '@infrastructure/auth/config-jwt';

const SEGREDO = 'x'.repeat(32);

describe('lerConfigJwt', () => {
  it('lê o segredo e usa 1h de expiração quando nada foi informado', () => {
    expect(lerConfigJwt({ JWT_SECRET: SEGREDO })).toEqual({ segredo: SEGREDO, expiracao: '1h' });
  });

  it('aceita a expiração informada', () => {
    for (const expiracao of ['30s', '15m', '2h', '7d']) {
      expect(lerConfigJwt({ JWT_SECRET: SEGREDO, JWT_EXPIRES_IN: expiracao }).expiracao).toBe(expiracao);
    }
  });

  it('sem segredo, ou com segredo curto, a aplicação não sobe', () => {
    expect(() => lerConfigJwt({})).toThrow('JWT_SECRET é obrigatório');
    expect(() => lerConfigJwt({ JWT_SECRET: '' })).toThrow('JWT_SECRET é obrigatório');
    expect(() => lerConfigJwt({ JWT_SECRET: 'curto' })).toThrow('ao menos 32 caracteres');
  });

  it('expiração fora do formato falha na subida, não na hora de emitir o token', () => {
    for (const ruim of ['', 'abc', '1', '0h', '-5m', '1.5h', '10 minutos']) {
      expect(() => lerConfigJwt({ JWT_SECRET: SEGREDO, JWT_EXPIRES_IN: ruim })).toThrow('JWT_EXPIRES_IN inválido');
    }
  });
});
