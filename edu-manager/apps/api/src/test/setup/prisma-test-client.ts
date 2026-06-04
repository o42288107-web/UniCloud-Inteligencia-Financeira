/**
 * prisma-test-client.ts
 *
 * Singleton do PrismaClient usado nos testes de integração.
 * Cada arquivo de teste importa este módulo — Jest garante que cada worker
 * Worker recebe sua própria instância via --runInBand ou isolamento de módulo.
 *
 * Uso:
 *   import { prismaTest, cleanDatabase } from '@test/setup/prisma-test-client';
 *
 *   beforeAll(() => prismaTest.$connect());
 *   afterAll(() => prismaTest.$disconnect());
 *   afterEach(() => cleanDatabase());
 */
import { PrismaClient } from '@edu-manager/database';

export const prismaTest: PrismaClient = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.TEST_DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/edumanager_test',
    },
  },
  log: process.env.PRISMA_DEBUG ? ['query', 'error'] : ['error'],
});

/**
 * Limpa TODAS as tabelas em ordem segura (sem violar FK).
 * Chame em `afterEach` nos testes de integração.
 */
export async function cleanDatabase(): Promise<void> {
  // Desabilita checagem de FK temporariamente — mais rápido que calcular a ordem
  await prismaTest.$executeRawUnsafe('SET session_replication_role = replica;');

  const tables = await prismaTest.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  for (const { tablename } of tables) {
    if (tablename === '_prisma_migrations') continue;
    await prismaTest.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
  }

  await prismaTest.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
}
