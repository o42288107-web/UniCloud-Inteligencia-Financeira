/**
 * school.factory.ts
 *
 * Factories para entidades raiz do domínio escolar.
 * Retornam objetos Plain (sem bater no banco) ou criam via Prisma.
 *
 * Convenção:
 *   build*()   → objeto puro (sem persistir)
 *   create*()  → persiste no banco de testes (precisa do prismaTest)
 */
import { PrismaClient } from '@edu-manager/database';

// ── Helpers ─────────────────────────────────────────────────────────────────

let _schoolCounter = 0;
let _cnpjCounter = 10000000;

function nextCnpj(): string {
  const n = ++_cnpjCounter;
  return `${String(n).padStart(2, '0')}.${String(Math.floor(n / 100)).padStart(3, '0')}.${String(Math.floor(n / 100000)).padStart(3, '0')}/0001-90`;
}

// ── School ───────────────────────────────────────────────────────────────────

export interface SchoolOverrides {
  name?: string;
  cnpj?: string;
  isActive?: boolean;
}

export function buildSchool(overrides: SchoolOverrides = {}) {
  _schoolCounter++;
  return {
    name: overrides.name ?? `Escola Teste ${_schoolCounter}`,
    cnpj: overrides.cnpj ?? nextCnpj(),
    phone: '(11) 3000-0000',
    email: `escola${_schoolCounter}@test.com`,
    isActive: overrides.isActive ?? true,
    settings: {},
  };
}

export async function createSchool(
  prisma: PrismaClient,
  overrides: SchoolOverrides = {},
): Promise<any> {
  return prisma.school.create({ data: buildSchool(overrides) });
}

// ── AcademicYear ─────────────────────────────────────────────────────────────

export interface AcademicYearOverrides {
  year?: number;
  isCurrent?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export async function createAcademicYear(
  prisma: PrismaClient,
  schoolId: string,
  overrides: AcademicYearOverrides = {},
) {
  const year = overrides.year ?? new Date().getFullYear();
  return prisma.academicYear.create({
    data: {
      schoolId,
      year,
      startDate: overrides.startDate ?? new Date(`${year}-02-01`),
      endDate: overrides.endDate ?? new Date(`${year}-12-15`),
      isCurrent: overrides.isCurrent ?? true,
    },
  });
}

// ── GradeLevel (Série) ────────────────────────────────────────────────────────

export interface GradeLevelOverrides {
  name?: string;
  shortName?: string;
  order?: number;
  stage?: string;
}

let _gradeLevelCounter = 0;

export async function createGradeLevel(
  prisma: PrismaClient,
  schoolId: string,
  overrides: GradeLevelOverrides = {},
) {
  _gradeLevelCounter++;
  return prisma.gradeLevel.create({
    data: {
      schoolId,
      name: overrides.name ?? `${_gradeLevelCounter}º Ano EF`,
      shortName: overrides.shortName ?? `${_gradeLevelCounter}A`,
      order: overrides.order ?? _gradeLevelCounter,
      stage: overrides.stage ?? 'FUNDAMENTAL_I',
    },
  });
}

// ── Class (Turma) ─────────────────────────────────────────────────────────────

export interface ClassOverrides {
  name?: string;
  shift?: string;
  maxStudents?: number;
  room?: string;
}

let _classCounter = 0;

export async function createClass(
  prisma: PrismaClient,
  {
    schoolId,
    academicYearId,
    gradeLevelId,
    overrides = {},
  }: {
    schoolId: string;
    academicYearId: string;
    gradeLevelId: string;
    overrides?: ClassOverrides;
  },
) {
  _classCounter++;
  return prisma.class.create({
    data: {
      schoolId,
      academicYearId,
      gradeLevelId,
      name: overrides.name ?? `T${_classCounter}`,
      shift: overrides.shift ?? 'MORNING',
      maxStudents: overrides.maxStudents ?? 35,
      room: overrides.room ?? `Sala ${_classCounter}`,
    },
  });
}

// ── Subject (Disciplina) ──────────────────────────────────────────────────────

export interface SubjectOverrides {
  name?: string;
  shortName?: string;
  bnccArea?: string;
}

let _subjectCounter = 0;
const SUBJECT_NAMES = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Inglês', 'Artes', 'Educação Física'];

export async function createSubject(
  prisma: PrismaClient,
  schoolId: string,
  overrides: SubjectOverrides = {},
) {
  _subjectCounter++;
  const name = overrides.name ?? SUBJECT_NAMES[_subjectCounter % SUBJECT_NAMES.length] + ` ${_subjectCounter}`;
  return prisma.subject.create({
    data: {
      schoolId,
      name,
      shortName: overrides.shortName ?? name.substring(0, 3).toUpperCase(),
      bnccArea: overrides.bnccArea,
    },
  });
}

/**
 * Cria o contexto escolar completo para uso nos testes.
 * Retorna escola + ano letivo + série + turma prontos para usar.
 */
export async function createSchoolContext(
  prisma: PrismaClient,
  opts: { maxStudents?: number } = {},
): Promise<any> {
  const school = await createSchool(prisma);
  const academicYear = await createAcademicYear(prisma, school.id);
  const gradeLevel = await createGradeLevel(prisma, school.id);
  const subject = await createSubject(prisma, school.id);
  const turma = await createClass(prisma, {
    schoolId: school.id,
    academicYearId: academicYear.id,
    gradeLevelId: gradeLevel.id,
    overrides: { maxStudents: opts.maxStudents ?? 35 },
  });

  return { school, academicYear, gradeLevel, subject, turma };
}
