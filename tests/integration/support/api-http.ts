import { spyOn } from 'bun:test';
import { criarApp } from '@presentation/http/criar-app';
import { compor } from '../../../src/composition-root';
import { criarRequisitor } from '../../integration/support/http';

/** API completa (composition root + rotas) sobre o banco de teste, chamada em memória, sem abrir porta. */
export function criarApiDeTeste() {
  // o publicador captura `console.info` ao ser construído: silenciar antes do `compor`
  const eventos = spyOn(console, 'info').mockImplementation(() => {});
  const { prisma, casos, guardJwt } = compor({
    databaseUrl: process.env.TEST_DATABASE_URL!, // o banco-de-teste já garante que existe e termina em _test
    jwt: { segredo: 'segredo-de-teste-com-mais-de-32-caracteres', expiracao: '1h' },
  });

  return {
    requisitar: criarRequisitor(criarApp(casos, guardJwt), guardJwt),
    async encerrar() {
      eventos.mockRestore();
      await prisma.$disconnect();
    },
  };
}
