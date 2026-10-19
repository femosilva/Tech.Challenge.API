import { criarPrismaClient } from '@infrastructure/persistence/prisma-client';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Defina TEST_DATABASE_URL (banco de teste, com migrations aplicadas)');
// o teste apaga tudo: nunca aponte para o banco de desenvolvimento
if (!/_test(\?|$)/.test(url)) throw new Error('TEST_DATABASE_URL deve apontar para um banco terminado em _test');

export const prisma = criarPrismaClient(url);

export async function limparBanco(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE clientes, veiculos, servicos, pecas, usuarios, ordens_servico, itens_servico, itens_peca, historico_status CASCADE',
  );
}
