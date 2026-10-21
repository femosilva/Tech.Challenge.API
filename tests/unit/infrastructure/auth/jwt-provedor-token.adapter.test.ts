import { describe, expect, it } from 'bun:test';
import { ALGORITMO_JWT, JwtProvedorTokenAdapter } from '@infrastructure/auth/jwt-provedor-token.adapter';
import { jwtVerify } from 'jose';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const chave = (segredo: string) => new TextEncoder().encode(segredo);

describe('JwtProvedorTokenAdapter', () => {
  it('emite um JWT HS256 com sub e papel, verificável com o mesmo segredo', async () => {
    const adapter = new JwtProvedorTokenAdapter({ segredo: SEGREDO, expiracao: '1h' });

    const token = await adapter.emitir({ sub: 'u1', papel: 'ADMINISTRADOR' });
    const { payload, protectedHeader } = await jwtVerify(token, chave(SEGREDO));

    expect(protectedHeader.alg).toBe(ALGORITMO_JWT);
    expect(payload.sub).toBe('u1');
    expect(payload.papel).toBe('ADMINISTRADOR');
  });

  it('a expiração vem da configuração', async () => {
    const umaHora = await new JwtProvedorTokenAdapter({ segredo: SEGREDO, expiracao: '1h' }).emitir({ sub: 'u1', papel: 'ATENDENTE' });
    const quinzeMin = await new JwtProvedorTokenAdapter({ segredo: SEGREDO, expiracao: '15m' }).emitir({ sub: 'u1', papel: 'ATENDENTE' });

    const a = (await jwtVerify(umaHora, chave(SEGREDO))).payload;
    const b = (await jwtVerify(quinzeMin, chave(SEGREDO))).payload;
    expect(a.exp! - a.iat!).toBe(3600);
    expect(b.exp! - b.iat!).toBe(900);
  });

  it('token assinado com um segredo não passa na verificação com outro', async () => {
    const token = await new JwtProvedorTokenAdapter({ segredo: SEGREDO, expiracao: '1h' }).emitir({ sub: 'u1', papel: 'MECANICO' });

    expect(jwtVerify(token, chave('outro-segredo-tambem-com-mais-de-32-caracteres'))).rejects.toThrow();
  });
});
