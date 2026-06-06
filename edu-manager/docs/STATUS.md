# EduManager — Status do Projeto

**Atualizado em:** 2026-06-05  
**Branch:** `claude/cto-agent-responsibilities-QbIPh`  
**Repositório:** `o42288107-web/UniCloud-Inteligencia-Financeira`  
**Pasta do projeto:** `edu-manager/`

---

## O que foi feito (Sprint 1 — Completo)

### Infraestrutura & Monorepo
- [x] Monorepo com Turborepo + pnpm workspaces (`pnpm-workspace.yaml`)
- [x] Estrutura: `apps/api` (NestJS), `apps/web` (Next.js 14), `packages/database` (Prisma), `packages/shared` (tipos TypeScript)
- [x] Docker Compose com PostgreSQL 16 + Redis 7 + MinIO (storage local) + API + Web
- [x] CI/CD — GitHub Actions com PostgreSQL + Redis como services, cache Turborepo
- [x] `.env.example` completo com todas as variáveis necessárias

### Banco de Dados
- [x] Schema Prisma completo com 30+ models cobrindo todos os 12 módulos do sistema
- [x] Migration inicial gerada e aplicada (`20260604_init`)
- [x] Enums: `UserRole`, `Gender`, `EnrollmentStatus`, `OccurrenceType`, `Shift`, `AssetStatus`, etc.
- [x] Multi-tenancy por `school_id` em todas as tabelas
- [x] Índices de performance em Teacher, TeacherClass, Subject, GradeLevel, ClassSchedule
- [x] Model `AuditLog` para rastreabilidade de ações

### Bugs P0 do Schema — Corrigidos
- [x] `Teacher` com `@@map("teachers")` adicionado
- [x] `ClassSchedule` com `teacherId` para vincular professor ao horário
- [x] `Class.shift` usando enum `Shift` (era `String`)
- [x] `ClassSchedule.startTime`/`endTime` convertidos para `@db.Time`
- [x] `Occurrence.reportedBy` corrigido para referenciar `User` (não `Teacher`)
- [x] `Enrollment.schoolId` redundante removido
- [x] Relações bidirecionais `School ↔ Student` e `School ↔ Teacher` adicionadas

### API (NestJS)
- [x] `AuthModule` — registro de escola, login, refresh token, logout, GET /me
  - JWT access token (15min) + refresh token rotation (7 dias)
  - Hash SHA-256 do refresh token antes de salvar no banco
  - Argon2id para senhas
  - Replay detection — revoga todas as sessões se token reutilizado
- [x] `StudentsModule` — CRUD completo de alunos
  - Paginação, busca, filtros
  - Criação em transação (User + Student + Enrollment + Guardians)
  - Soft-delete via `deletedAt`
  - Endpoints: GET/POST/PATCH/DELETE /students, POST /students/:id/enroll
- [x] `HealthModule` — GET /health com check de banco
- [x] `PrismaModule` global com `onModuleInit` / `enableShutdownHooks`
- [x] `ValidationPipe` global (`whitelist: true`, `forbidNonWhitelisted: true`)
- [x] `HttpExceptionFilter` global com envelope de erro padronizado
- [x] `TransformInterceptor` — resposta sempre em `{ data, message, statusCode }`
- [x] Swagger/OpenAPI em `/api/docs`
- [x] `RolesGuard` + `@Roles()` decorator para RBAC
- [x] `JwtAuthGuard` com tipo de retorno corrigido
- [x] `ThrottlerModule` para rate limiting

### Frontend (Next.js 14)
- [x] App Router com route groups: `(auth)` e `(dashboard)`
- [x] Página de Login com react-hook-form + Zod
- [x] Axios client com interceptor de refresh automático
- [x] Access token em memória (não em sessionStorage — segurança)
- [x] Sidebar colapsável com navegação de todos os módulos
- [x] Dashboard com cards de estatísticas (placeholder)
- [x] Página de listagem de alunos (tabela com paginação)
- [x] Formulário de cadastro de alunos (3 abas: Dados Pessoais, Responsáveis, Documentos)
- [x] `next.config.mjs` (convertido de `.ts` que não é suportado)
- [x] Path alias `@/*` configurado no tsconfig

### Segurança
- [x] `contextIsolation: true` (Electron não se aplica — arquitetura web)
- [x] Allowlist para campo `sort` no `StudentQueryDto`
- [x] `Prisma.InputJsonValue` cast nos campos JSON
- [x] Sem hardcode de segredos — apenas `.env`

### Infraestrutura de Testes
- [x] `jest.config.ts` com projetos unit e integration separados
- [x] Factories: `createSchool`, `createSchoolContext`, `createTeacher`, `createStudent`
- [x] Helper `NestTestApp` para testes de integração
- [x] Setup do cliente Prisma para testes

### Time de Agentes Criados (`.claude/agents/`)
- [x] 15 agentes especializados criados e configurados
- [x] `tech-lead`, `solution-architect`, `senior-fullstack`, `frontend-dev`, `backend-dev`
- [x] `mobile-dev`, `systems-dev`, `dba`, `data-engineer`, `ai-engineer`
- [x] `devops`, `cloud-architect`, `qa-engineer`, `performance-engineer`
- [x] `security-engineer`, `pentester`, `cybersecurity-analyst`

---

## O que NÃO foi feito (Sprint 2 em diante)

### Sprint 2 — Professores, Turmas, Séries e Disciplinas (PRÓXIMO)

#### Backend (NestJS) — 42 endpoints definidos, zero implementados
- [ ] `GradeLevelsModule` — CRUD de séries escolares (1º Ano EF, 2ª Série EM, etc.)
- [ ] `SubjectsModule` — CRUD de disciplinas (Matemática, Português, etc.) + áreas BNCC
- [ ] `TeachersModule` — Cadastro de professores + vínculos disciplina/turma + grade horária
- [ ] `ClassesModule` — Turmas + matrícula de alunos + transferência + grade horária semanal

#### Frontend (Next.js) — Componentes e telas
- [ ] Componentes reutilizáveis: `PageHeader`, `DataTable`, `FormField`, `ConfirmDialog`, `StatusBadge`, `FormTabs`, `SearchBar`, `Avatar`, `WeeklySchedule`
- [ ] Tela de listagem e cadastro de Séries Escolares
- [ ] Tela de listagem e cadastro de Disciplinas
- [ ] Tela de listagem e cadastro de Professores
- [ ] Tela de vínculo Professor ↔ Turma ↔ Disciplina
- [ ] Tela de listagem e cadastro de Turmas
- [ ] Grade horária semanal interativa
- [ ] Dashboard com métricas reais (alunos por turma, vagas, professores sem turma)

#### Infraestrutura Sprint 2
- [ ] `CASL` (`@casl/ability`) para ABAC — professor só vê suas turmas
- [ ] `AuditService` — registrar CREATE/UPDATE/DELETE no `AuditLog`
- [ ] `RedisModule` global com `ioredis` + cache-aside (AcademicYear, GradeLevel, Class)
- [ ] `UploadsModule` — presigned URL para S3/MinIO + validação de magic bytes

---

### Sprint 3 — Notas e Frequência
- [ ] `AssessmentsModule` — avaliações e lançamento de notas
- [ ] `AttendanceModule` — registro de frequência diária por turma
- [ ] `ClassDiaryModule` — diário de classe do professor
- [ ] `LessonPlansModule` — planos de aula com referência à BNCC
- [ ] Telas de boletim e frequência do aluno

### Sprint 4 — Portais de Aluno e Pais
- [ ] Route groups `/student` e `/parent` no Next.js
- [ ] Portal do Aluno — boletim, frequência, horário, comunicados
- [ ] Portal dos Pais/Responsáveis — acompanhamento, autorização de saída, notificações
- [ ] Notificações push (Firebase FCM)

### Sprint 5 — Ocorrências Escolares
- [ ] `OccurrencesModule` — registro de ocorrências com tipos e severidade
- [ ] Upload de evidências (foto/PDF) via MinIO
- [ ] Notificação automática aos pais em ocorrências graves
- [ ] Tela de gestão de ocorrências com filtros e histórico

### Sprint 6 — Comunicação
- [ ] Sistema de mensagens internas (1:1 e em grupo)
- [ ] `AnnouncementsModule` — comunicados segmentados por turma/série/escola
- [ ] Integração WhatsApp Business para notificações

### Sprint 7 — Merenda Escolar (PNAE)
- [ ] `FoodInventoryModule` — controle de estoque de alimentos
- [ ] `MealPlansModule` — cardápio semanal por turno
- [ ] Relatórios PNAE com totais por escola e por dia

### Sprint 8 — Inventário e Patrimônio
- [ ] `AssetsModule` — cadastro de patrimônio com QR Code
- [ ] `StockModule` — controle de estoque com movimentações
- [ ] Geração de etiquetas QR Code para impressão

### Sprint 9 — IA e Analytics
- [ ] `AIModule` — integração com Claude API (RAG sobre dados da escola)
- [ ] Assistente IA para professores (sugestão de atividades baseadas na BNCC)
- [ ] Analytics: taxa de evasão, alunos em risco, padrões de frequência
- [ ] `DigitizedContentModule` — OCR de documentos físicos

### Sprint 10 — DRE e Multi-escola
- [ ] `DREModule` — painel da Diretoria Regional (visão de N escolas)
- [ ] Relatórios consolidados DRE: frequência, desempenho, PNAE
- [ ] Gestão de usuários `DRE_MANAGER`

---

## Decisões Arquiteturais Pendentes (ADRs)

| ADR | Título | Status |
|-----|--------|--------|
| ADR-002 | Estratégia de upload (presigned URL vs upload direto) | Proposto — implementar no Sprint 2 |
| ADR-003 | Cache com Redis (cache-aside, TTLs, invalidação) | Proposto — implementar no Sprint 2 |
| ADR-004 | ABAC com CASL para recursos pedagógicos de TEACHER | Proposto — implementar no Sprint 2 |

---

## Dívida Técnica Conhecida

| Item | Impacto | Quando resolver |
|------|---------|----------------|
| Sem testes unitários/E2E (CI passa vazio) | Alto — risco de regressão | Sprint 2 |
| `generateEnrollmentNo` com race condition | Médio — concorrência | Sprint 2 |
| Redis provisionado mas não usado no código | Médio — performance | Sprint 2 |
| `dashboard.js` equivalente — dashboard sem dados reais | Alto — UX | Sprint 2 |
| Sem logging estruturado (`electron-log` equiv.) | Médio — observabilidade | Sprint 3 |

---

## Credenciais de Teste (Ambiente Local)

```
Email:  admin@demo.edu.br
Senha:  Demo@1234
Escola: Escola Demo EduManager
CNPJ:   12.345.678/0001-90
```

---

## Como rodar localmente

```bash
# 1. Entrar na pasta
cd edu-manager

# 2. Instalar dependências
pnpm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com seu DATABASE_URL e segredos JWT

# 4. Subir banco e Redis
docker compose up -d postgres redis

# 5. Rodar migrations
pnpm --filter @edu-manager/database db:generate
pnpm --filter @edu-manager/database db:migrate:dev

# 6. Subir a aplicação
pnpm dev   # inicia API (3001) e Web (3000) em paralelo
```

---

## Stack Resumida

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| ORM | Prisma 5 |
| Banco | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | MinIO (dev) / Cloudflare R2 (prod) |
| Auth | JWT (access 15min) + Refresh token rotation |
| Monorepo | Turborepo + pnpm workspaces |
| CI/CD | GitHub Actions |
| Containers | Docker Compose |
