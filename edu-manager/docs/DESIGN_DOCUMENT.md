# EduManager — Technical Design Document
**Versão:** 1.0  
**Status:** Aprovado pelo time  
**Data:** 2026-06-03  
**Time:** CTO · Solution Architect · Tech Lead · Backend · Frontend · DBA · DevOps · Security · AI Engineer

---

## 1. Visão Geral

### 1.1 Problema
Escolas públicas e privadas no Brasil operam com sistemas fragmentados: controle de alunos em planilhas, diários de classe em papel, comunicação por grupos de WhatsApp informais e merenda gerenciada manualmente. A ausência de integração gera retrabalho, perda de dados e dificuldade de compliance com o MEC/FNDE.

### 1.2 Solução
**EduManager** é uma plataforma SaaS multi-tenant de gestão escolar completa, cobrindo desde matrícula de alunos até fiscalização da DRE, com IA integrada para suporte pedagógico e analytics preditivo.

### 1.3 Usuários-alvo
| Perfil | Responsabilidade |
|--------|-----------------|
| Diretor | Visão geral da escola, gestão administrativa |
| Coordenador Pedagógico | Acompanhamento pedagógico, ocorrências |
| Professor | Diário de classe, avaliações, planos de aula |
| Aluno | Portal de notas, tarefas, materiais |
| Pai/Responsável | Acompanhamento do filho, comunicação |
| Gestor DRE | Fiscalização regional, comparativo de escolas |
| Admin do Sistema | Onboarding de novas escolas |

---

## 2. Arquitetura do Sistema

### 2.1 Visão de alto nível

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│  Web Browser (Next.js)  │  Mobile (PWA)  │  API Consumers   │
└─────────────┬───────────┴────────┬────────┴─────────────────┘
              │                    │
              ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    CDN / WAF (Cloudflare)                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐
│  Next.js (SSR)  │  │  NestJS API     │  │  Socket.io   │
│  Vercel/Cloud   │  │  (REST + WS)    │  │  (real-time) │
└────────┬────────┘  └────────┬────────┘  └──────┬───────┘
         │                   │                    │
         │           ┌───────┴────────┐           │
         │           │                │           │
         │    ┌──────▼──────┐  ┌──────▼──────┐   │
         │    │ PostgreSQL  │  │    Redis     │◄──┘
         │    │ (Principal) │  │ (Cache/WS)   │
         │    └─────────────┘  └─────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │  Serviços externos                     │
    │  · Anthropic API (IA)                 │
    │  · AWS S3 (arquivos)                  │
    │  · Firebase FCM (push)               │
    │  · SendGrid (e-mail)                  │
    │  · WhatsApp Business API             │
    └───────────────────────────────────────┘
```

### 2.2 Multi-tenancy
**Estratégia:** Shared database, shared schema com `school_id` em todas as tabelas + PostgreSQL Row Level Security (RLS).

**Justificativa:**
- Menor custo operacional (1 banco vs N bancos)
- Migrations centralizadas
- Isolamento garantido pelo RLS no nível do banco
- Escala para centenas de escolas sem overhead de provisionamento

### 2.3 ADR-001: Stack tecnológica

**Decisão:** Next.js 14 + NestJS + Prisma + PostgreSQL + Redis

| Camada | Escolha | Alternativa descartada | Motivo |
|--------|---------|----------------------|--------|
| Frontend | Next.js 14 (App Router) | Vue/Nuxt, SvelteKit | SSR nativo, React ecosystem, Vercel deploy |
| UI | shadcn/ui + Tailwind | Material UI, Ant Design | Headless, customizável, zero lock-in |
| Backend | NestJS (TypeScript) | Express, Fastify | Módulos = nossos módulos de negócio, DI nativo, Swagger integrado |
| ORM | Prisma | TypeORM, Drizzle | Migrations versionadas, type-safety total, client gerado |
| Banco principal | PostgreSQL 16 | MySQL, MongoDB | JSONB, RLS, full-text search, pgvector para IA |
| Cache / RT | Redis | Memcached | Pub/sub para real-time, queues, sessões |
| Monorepo | Turborepo + pnpm | Nx, Lerna | Cache de build, simples, adotado pela Vercel |
| Auth | JWT (access 15min) + Refresh (7d) httpOnly cookie | NextAuth, Clerk | Controle total, multi-role, sem vendor lock |

### 2.4 ADR-002: Monorepo structure

```
edu-manager/
├── apps/
│   ├── web/          # Next.js 14 — interface do usuário
│   └── api/          # NestJS — API REST + WebSocket
├── packages/
│   ├── database/     # Prisma schema + client
│   └── shared/       # Types, DTOs, constants compartilhados
├── turbo.json
└── package.json
```

---

## 3. Módulos e Prioridade

| # | Módulo | Sprint | Complexidade |
|---|--------|--------|-------------|
| 1 | Auth & Multi-tenant (escola) | Sprint 1 | M |
| 2 | Gestão de Alunos | Sprint 1-2 | L |
| 3 | Gestão de Professores | Sprint 2 | L |
| 4 | Gestão Pedagógica (turmas, notas, frequência) | Sprint 3 | XL |
| 5 | Portal do Aluno | Sprint 3 | M |
| 6 | Portal dos Pais | Sprint 4 | M |
| 7 | Ocorrências Escolares | Sprint 4 | M |
| 8 | Comunicação (chat, comunicados, notificações) | Sprint 5 | L |
| 9 | Diário de Classe + Plano de Aula | Sprint 5 | L |
| 10 | IA Assistente (Professor + Aluno) | Sprint 6 | XL |
| 11 | Digitalização Inteligente (OCR) | Sprint 7 | XL |
| 12 | CRM Escolar (Kanban) | Sprint 7 | M |
| 13 | Merenda Escolar (PNAE) | Sprint 8 | L |
| 14 | Inventário e Patrimônio | Sprint 8 | M |
| 15 | Coordenação (Dashboard) | Sprint 9 | M |
| 16 | DRE (Regional) | Sprint 9 | L |
| 17 | Análise Preditiva | Sprint 10 | XL |
| 18 | Relatórios Inteligentes | Sprint 10 | L |

---

## 4. Design de Banco de Dados

### 4.1 Grupos de entidades

```
TENANCY
  School, AcademicYear

IDENTIDADE
  User, Session, UserRole (enum)

ALUNOS
  Student, Guardian, StudentGuardian, Enrollment, Document

PROFESSORES
  Teacher, TeacherSubject, TeacherClass

ESTRUTURA ACADÊMICA
  Class, GradeLevel, Subject, ClassSchedule

DIÁRIO / PEDAGÓGICO
  ClassDiary, LessonPlan, Assessment, Grade, Attendance

OCORRÊNCIAS
  Occurrence, OccurrenceFile, OccurrenceNotification

COMUNICAÇÃO
  Message, Announcement, Notification

MERENDA (PNAE)
  MealPlan, FoodItem, FoodInventory, FoodMovement, PNAEReport

PATRIMÔNIO / ESTOQUE
  Asset, StockItem, StockMovement

IA
  AIConversation, AIMessage, DigitizedContent

CRM
  Task, InternalRequest
```

### 4.2 Convenções de schema
- Chaves primárias: UUID v4 (`gen_random_uuid()`)
- Timestamps: `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ`
- Soft delete: `deleted_at TIMESTAMPTZ NULL`
- Auditoria: `created_by UUID`, `updated_by UUID`
- Monetary values: `NUMERIC(10,2)`
- Multi-tenant: `school_id UUID NOT NULL` em TODAS as tabelas (exceto School)

---

## 5. API Design

### 5.1 Convenções REST
```
Base URL: /api/v1

Recursos:     /api/v1/{recurso}                    (collection)
              /api/v1/{recurso}/{id}                (item)
              /api/v1/{recurso}/{id}/{sub-recurso}  (nested)

Paginação:    ?page=1&limit=20&search=texto&sort=name:asc
Response:     { data: [...], pagination: { page, limit, total, totalPages } }
Erros:        { error: { code, message, field? } }
```

### 5.2 Autenticação
```
POST /api/v1/auth/login          # login → { accessToken, user }
POST /api/v1/auth/refresh        # refresh → { accessToken }
POST /api/v1/auth/logout         # logout (revoga refresh token)
POST /api/v1/schools/register    # cadastro de nova escola (admin)

Headers: Authorization: Bearer <accessToken>
Refresh: httpOnly cookie (refreshToken)
```

### 5.3 Módulo Alunos
```
GET    /api/v1/students              # listar (paginado, filtros)
POST   /api/v1/students              # cadastrar
GET    /api/v1/students/:id          # detalhar
PATCH  /api/v1/students/:id          # atualizar
DELETE /api/v1/students/:id          # desativar (soft delete)

GET    /api/v1/students/:id/enrollments    # histórico escolar
POST   /api/v1/students/:id/enrollments    # matricular em turma
GET    /api/v1/students/:id/documents      # documentos
POST   /api/v1/students/:id/documents      # upload documento
GET    /api/v1/students/:id/guardians      # responsáveis
POST   /api/v1/students/:id/guardians      # vincular responsável
GET    /api/v1/students/:id/grades         # notas
GET    /api/v1/students/:id/attendance     # frequência
GET    /api/v1/students/:id/occurrences    # ocorrências
```

---

## 6. Segurança

### 6.1 Modelo de autorização (RBAC)
```
SUPER_ADMIN     → acesso total (operações da plataforma)
SCHOOL_ADMIN    → escola inteira
COORDINATOR     → escola inteira (sem configurações críticas)
TEACHER         → suas turmas + seus alunos
STUDENT         → apenas seus próprios dados
PARENT          → apenas dados dos seus filhos
DRE_MANAGER     → leitura em todas as escolas da sua DRE
```

### 6.2 Controles obrigatórios
- Argon2id para hashing de senhas
- JWT com rotação de refresh token
- Rate limiting: 10 req/s por IP, 100 req/s por escola
- CORS restrito ao domínio do frontend
- Helmet.js (headers de segurança)
- Validação de input com class-validator em todos os DTOs
- SQL: apenas Prisma (zero raw queries sem parameterização)
- Upload: validar MIME type, tamanho máximo 10MB, scan de vírus (ClamAV)
- LGPD: dados de menores de 18 anos têm proteção extra, consentimento do responsável

### 6.3 Dados sensíveis
- CPF, data de nascimento de menores: criptografados em repouso (AES-256-GCM)
- Senha: nunca retornada em nenhum endpoint
- Logs: nunca logar CPF, senha ou dados pessoais de alunos

---

## 7. Observabilidade

```
Logs:      JSON estruturado (Pino) → CloudWatch / Loki
Métricas:  Prometheus → Grafana (latência, erros, usuários ativos)
Traces:    OpenTelemetry → Jaeger
Alertas:   P95 > 500ms, erro 5xx > 1%, DB conexões > 80%
Uptime:    Healthcheck em /api/health (DB, Redis, S3)
```

---

## 8. Plano de Sprints

### Sprint 1 — Foundation (2 semanas)
**Objetivo:** Sistema funcionando com auth + cadastro de alunos

**Backend:**
- [ ] Setup NestJS monorepo (Turborepo + pnpm)
- [ ] Prisma schema completo (todos os módulos)
- [ ] AuthModule: login, refresh, logout, RBAC guard
- [ ] SchoolModule: registro de escola + admin
- [ ] StudentsModule: CRUD completo + matrícula + responsáveis + documentos

**Frontend:**
- [ ] Setup Next.js 14 App Router + shadcn/ui + Tailwind
- [ ] Layout autenticado (sidebar, header)
- [ ] Tela de login
- [ ] Listagem de alunos (tabela com busca, filtros, paginação)
- [ ] Formulário de cadastro de aluno (dados pessoais, responsáveis, documentos)
- [ ] Tela de detalhe do aluno (overview + histórico)

**Infra:**
- [ ] Docker Compose (dev: postgres + redis + api + web)
- [ ] GitHub Actions: lint + test + build
- [ ] .env.example documentado

### Sprint 2 — Professores + Turmas
- Cadastro de professores
- Gestão de turmas (séries, turmas, vinculação de professores)
- Matrícula de alunos em turmas

### Sprint 3 — Notas + Frequência + Portais
- Avaliações e notas
- Registro de frequência
- Portal do Aluno (boletim, horários)
- Portal dos Pais

### Sprint 4 — Ocorrências + Comunicação
- Registro de ocorrências
- Chat professor-pais
- Comunicados por turma
- Notificações (push + email)

### Sprint 5 — Diário de Classe + Plano de Aula
- Chamada digital
- Registro de conteúdo
- Planos de aula com BNCC

### Sprint 6 — IA Assistente
- Assistente IA do professor (criar provas, atividades, planos de aula)
- Assistente IA do aluno
- Análise de desempenho por IA

### Sprint 7 — Digitalização + CRM
- OCR de caderno (foto → texto)
- Biblioteca digital
- Kanban de tarefas

### Sprint 8 — PNAE + Patrimônio
- Cardápios e estoque de merenda
- Relatórios PNAE
- Patrimônio com QR Code

### Sprint 9 — Coordenação + DRE
- Dashboard da coordenação
- Dashboard DRE regional
- Comparativo de escolas

### Sprint 10 — Analytics + Relatórios
- Análise preditiva (evasão, queda de desempenho)
- Relatórios automáticos por IA
- Exportação PDF/Excel

---

## 9. Estimativa de Infraestrutura (produção)

| Serviço | Tier inicial | Custo estimado/mês |
|---------|-------------|-------------------|
| App (Render/Railway) | 2 instâncias | R$ 200 |
| PostgreSQL (Neon/Supabase) | 8GB | R$ 150 |
| Redis (Upstash) | 100MB | R$ 50 |
| S3 (Cloudflare R2) | 50GB | R$ 40 |
| CDN (Cloudflare) | Free tier | R$ 0 |
| **Total** | | **~R$ 440/mês** |

Suporta até ~500 escolas ativas com até 200 usuários simultâneos.
