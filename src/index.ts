import { criarApp } from '@presentation/http/criar-app';
import { compor } from './composition-root';
import { lerConfigAmbiente } from './config-ambiente';

const config = lerConfigAmbiente();
const { prisma } = compor(config);
const app = criarApp().listen(config.porta);

console.log(`API no ar na porta ${app.server?.port} (documentação em /openapi)`);

/** O Docker manda SIGTERM no `stop`: fecha o servidor e devolve as conexões ao Postgres antes de sair. */
async function encerrar() {
  await app.stop();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
