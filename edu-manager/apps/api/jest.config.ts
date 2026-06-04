import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!**/main.ts', '!**/*.dto.ts'],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@edu-manager/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@edu-manager/database$': '<rootDir>/../../packages/database/src/index.ts',
  },
  projects: [
    // ── Testes Unitários (sem banco) ──────────────────────────────
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/**/*.spec.ts'],
      testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$', '\\.e2e\\.spec\\.ts$'],
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      moduleNameMapper: {
        '^@edu-manager/shared$': '<rootDir>/../../packages/shared/src/index.ts',
        '^@edu-manager/database$': '<rootDir>/../../packages/database/src/index.ts',
      },
    },
    // ── Testes de Integração (Postgres real via env TEST_DATABASE_URL) ─
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/**/*.integration.spec.ts'],
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      moduleNameMapper: {
        '^@edu-manager/shared$': '<rootDir>/../../packages/shared/src/index.ts',
        '^@edu-manager/database$': '<rootDir>/../../packages/database/src/index.ts',
      },
      globalSetup: '<rootDir>/test/setup/global-setup.ts',
      globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
    },
  ],
  globals: {
    'ts-jest': {
      tsconfig: {
        // Herda do tsconfig.json do projeto, mas força o strict mínimo necessário
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
};

export default config;
