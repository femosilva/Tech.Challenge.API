export type ConfigJwt = {
  segredo: string;
  /** Duração no formato do `jose`: número e unidade (`s`, `m`, `h` ou `d`), como `15m` ou `1h`. */
  expiracao: string;
};

const EXPIRACAO_PADRAO = '1h';
const TAMANHO_MINIMO_SEGREDO = 32;
const FORMATO_EXPIRACAO = /^[1-9]\d*[smhd]$/;

/** Sem segredo padrão: se `JWT_SECRET` faltar ou for curto, a aplicação não sobe. */
export function lerConfigJwt(env: Record<string, string | undefined> = process.env): ConfigJwt {
  const segredo = env.JWT_SECRET;
  if (!segredo || segredo.length < TAMANHO_MINIMO_SEGREDO) {
    throw new Error(`JWT_SECRET é obrigatório e precisa ter ao menos ${TAMANHO_MINIMO_SEGREDO} caracteres`);
  }
  const expiracao = env.JWT_EXPIRES_IN ?? EXPIRACAO_PADRAO;
  if (!FORMATO_EXPIRACAO.test(expiracao)) {
    throw new Error(`JWT_EXPIRES_IN inválido: "${expiracao}" (use número e unidade, como 15m, 1h ou 7d)`);
  }
  return { segredo, expiracao };
}
