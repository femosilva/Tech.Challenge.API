import { type ConfigJwt, lerConfigJwt } from '@infrastructure/auth/config-jwt';

export type ConfigAmbiente = {
  databaseUrl: string;
  porta: number;
  jwt: ConfigJwt;
};

const PORTA_PADRAO = 3000;
const PORTA_MAXIMA = 65535;

function lerPorta(valor: string | undefined): number {
  if (valor === undefined) return PORTA_PADRAO;
  const porta = Number(valor);
  if (!/^\d+$/.test(valor) || porta < 1 || porta > PORTA_MAXIMA) {
    throw new Error(`PORT inválida: "${valor}" (use um número entre 1 e ${PORTA_MAXIMA})`);
  }
  return porta;
}

/** Falha na subida, com mensagem clara, em vez de quebrar na primeira requisição. */
export function lerConfigAmbiente(env: Record<string, string | undefined> = process.env): ConfigAmbiente {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL é obrigatória');
  return { databaseUrl, porta: lerPorta(env.PORT), jwt: lerConfigJwt(env) };
}
