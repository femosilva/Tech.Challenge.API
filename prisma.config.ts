import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Sem env(): ele lança se a variável faltar, e o `generate` (postinstall, CI) não precisa de banco.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
