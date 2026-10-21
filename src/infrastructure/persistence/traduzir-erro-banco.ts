import { ConflitoError } from '@application/core/erros';
import { Prisma } from './generated/client';

/** Cada operação diz quais violações espera; o que não foi declarado sobe como veio. */
export type MensagensConflito = {
  /** P2002: índice único (documento, placa, código, e-mail). */
  unicidade?: string;
  /** P2003 em `remover`: FK Restrict impediu apagar. */
  vinculo?: string;
};

function traduzir(erro: unknown, mensagens: MensagensConflito): unknown {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError)) return erro;
  if (erro.code === 'P2002' && mensagens.unicidade) return new ConflitoError(mensagens.unicidade);
  if (erro.code === 'P2003' && mensagens.vinculo) return new ConflitoError(mensagens.vinculo);
  return erro;
}

export async function comTraducao<T>(mensagens: MensagensConflito, operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    throw traduzir(erro, mensagens);
  }
}
