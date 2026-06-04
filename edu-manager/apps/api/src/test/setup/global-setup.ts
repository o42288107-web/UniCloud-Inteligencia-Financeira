/**
 * global-setup.ts
 *
 * Executado UMA VEZ antes de todos os testes de integração.
 * Conecta no banco de testes (TEST_DATABASE_URL) e roda as migrations.
 *
 * Banco alvo: PostgreSQL isolado por schema "test_<timestamp>" para que
 * suites paralelas não se pisen.  Em CI o serviço postgres já está up
 * (ver .github/workflows/ci.yml).
 */
import { execSync } from 'child_process';

export default async function globalSetup() {
  const dbUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/edumanager_test';

  // Expõe para todos os workers
  process.env.TEST_DATABASE_URL = dbUrl;

  console.log('[test-setup] Rodando migrations no banco de testes...');
  execSync('pnpm --filter @edu-manager/database exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });
  console.log('[test-setup] Migrations aplicadas.');
}
