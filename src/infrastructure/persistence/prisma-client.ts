import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/client';

/** O que os adapters recebem: o client normal ou o client de dentro de um `$transaction`. */
export type BancoDados = PrismaClient | Prisma.TransactionClient;

export function criarPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
