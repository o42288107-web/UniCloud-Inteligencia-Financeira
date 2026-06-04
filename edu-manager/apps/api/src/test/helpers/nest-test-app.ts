/**
 * nest-test-app.ts
 *
 * Helper para criar um NestJS app de testes com supertest.
 * Usado nos testes de integração de controllers/endpoints.
 *
 * Uso:
 *   const { app, request } = await createTestApp([TeachersModule]);
 *   await request.get('/teachers').set('Authorization', `Bearer ${token}`).expect(200);
 *   await app.close();
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as supertest from 'supertest';
import { PrismaModule } from '../../prisma/prisma.module';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

export interface TestApp {
  app: INestApplication;
  request: supertest.Agent;
}

export async function createTestApp(
  modules: any[],
  overrides?: (builder: any) => any,
): Promise<TestApp> {
  let builder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            JWT_SECRET: 'test-secret-for-jest-only',
            JWT_EXPIRES_IN: '15m',
            NODE_ENV: 'test',
            DATABASE_URL:
              process.env.TEST_DATABASE_URL ??
              'postgresql://postgres:postgres@localhost:5432/edumanager_test',
          }),
        ],
      }),
      PrismaModule,
      ...modules,
    ],
  });

  if (overrides) {
    builder = overrides(builder);
  }

  const module: TestingModule = await builder.compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api/v1');

  await app.init();

  return {
    app,
    request: supertest(app.getHttpServer()),
  };
}

/**
 * Gera um JWT válido para uso nos testes de integração,
 * sem precisar bater no banco de autenticação.
 *
 * Precisa de JwtService do módulo de auth — use apenas quando
 * o AuthModule está incluído no createTestApp.
 */
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@edu-manager/shared';

export function generateTestToken(jwtService: JwtService, payload: JwtPayload): string {
  return jwtService.sign(payload, {
    secret: 'test-secret-for-jest-only',
    expiresIn: '15m',
  });
}
