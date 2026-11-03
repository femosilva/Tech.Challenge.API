import { t } from 'elysia';

export const loginBody = t.Object({
  email: t.String({ minLength: 1, maxLength: 254, examples: ['admin@oficina.local'] }),
  // o teto evita gastar argon2 com entradas gigantes
  senha: t.String({ minLength: 1, maxLength: 128, examples: ['admin123'] }),
});

export const loginResposta = t.Object({
  token: t.String({ description: 'JWT para o cabeçalho Authorization: Bearer <token>' }),
});
