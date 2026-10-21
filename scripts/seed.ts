import { BunHashSenhaAdapter } from '@infrastructure/auth/bun-hash-senha.adapter';
import { UsuarioRepositoryAdapter } from '@infrastructure/persistence/identidade/usuario-repository.adapter';
import { semearUsuariosDemo, USUARIOS_DEMO } from '@infrastructure/persistence/identidade/usuarios-demo.seed';
import { criarPrismaClient } from '@infrastructure/persistence/prisma-client';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Defina DATABASE_URL');

const prisma = criarPrismaClient(url);
try {
  const criados = await semearUsuariosDemo(new UsuarioRepositoryAdapter(prisma), new BunHashSenhaAdapter());
  console.log(`Seed: ${criados} usuário(s) criado(s), ${USUARIOS_DEMO.length - criados} já existiam.`);
} finally {
  await prisma.$disconnect();
}
