/**
 * user.factory.ts
 *
 * Factories para User, Teacher e Student com seus vínculos.
 */
import { PrismaClient } from '@edu-manager/database';
import * as argon2 from 'argon2';

// Senha em texto plano default — hash cacheado para não repetir argon2 em cada teste
const DEFAULT_PLAIN_PASSWORD = 'Senha@123Test';
let _hashedDefaultPassword: string | null = null;

async function getDefaultHash(): Promise<string> {
  if (!_hashedDefaultPassword) {
    _hashedDefaultPassword = await argon2.hash(DEFAULT_PLAIN_PASSWORD);
  }
  return _hashedDefaultPassword;
}

let _userCounter = 0;

// ── User ─────────────────────────────────────────────────────────────────────

export interface UserOverrides {
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  password?: string;
}

export async function createUser(
  prisma: PrismaClient,
  schoolId: string,
  overrides: UserOverrides = {},
) {
  _userCounter++;
  const password = overrides.password
    ? await argon2.hash(overrides.password)
    : await getDefaultHash();

  return prisma.user.create({
    data: {
      schoolId,
      email: overrides.email ?? `user${_userCounter}@test.com`,
      password,
      name: overrides.name ?? `Usuário Teste ${_userCounter}`,
      role: (overrides.role ?? 'SCHOOL_ADMIN') as any,
      isActive: overrides.isActive ?? true,
    },
  });
}

// ── Teacher ──────────────────────────────────────────────────────────────────

export interface TeacherOverrides {
  name?: string;
  email?: string;
  specialization?: string;
  weeklyHours?: number;
  registrationNo?: string;
}

export async function createTeacher(
  prisma: PrismaClient,
  schoolId: string,
  overrides: TeacherOverrides = {},
): Promise<any> {
  _userCounter++;
  const password = await getDefaultHash();
  const email = overrides.email ?? `professor${_userCounter}@test.com`;

  const user = await prisma.user.create({
    data: {
      schoolId,
      email,
      password,
      name: overrides.name ?? `Professor ${_userCounter}`,
      role: 'TEACHER',
      isActive: true,
    },
  });

  const teacher = await prisma.teacher.create({
    data: {
      userId: user.id,
      schoolId,
      birthDate: new Date('1985-06-15'),
      registrationNo: overrides.registrationNo ?? `REG-${_userCounter}`,
      specialization: overrides.specialization,
      weeklyHours: overrides.weeklyHours ?? 20,
    },
  });

  return { user, teacher };
}

// ── Student ──────────────────────────────────────────────────────────────────

export interface StudentOverrides {
  name?: string;
  email?: string;
  birthDate?: Date;
  enrollmentNo?: string;
}

export async function createStudent(
  prisma: PrismaClient,
  schoolId: string,
  overrides: StudentOverrides = {},
): Promise<any> {
  _userCounter++;
  const password = await getDefaultHash();
  const email = overrides.email ?? `aluno${_userCounter}@test.com`;

  const user = await prisma.user.create({
    data: {
      schoolId,
      email,
      password,
      name: overrides.name ?? `Aluno ${_userCounter}`,
      role: 'STUDENT',
      isActive: true,
    },
  });

  const student = await prisma.student.create({
    data: {
      userId: user.id,
      schoolId,
      enrollmentNo: overrides.enrollmentNo ?? `${new Date().getFullYear()}-${String(_userCounter).padStart(4, '0')}`,
      birthDate: overrides.birthDate ?? new Date('2010-03-20'),
      gender: 'MALE',
    },
  });

  return { user, student };
}

/**
 * Matricula um aluno em uma turma no ano letivo dado.
 */
export async function enrollStudent(
  prisma: PrismaClient,
  {
    studentId,
    classId,
    academicYearId,
    schoolId,
  }: {
    studentId: string;
    classId: string;
    academicYearId: string;
    schoolId: string;
  },
) {
  return prisma.enrollment.create({
    data: { studentId, classId, academicYearId, schoolId, status: 'ACTIVE' },
  });
}

/**
 * Vincula professor a uma disciplina.
 */
export async function linkTeacherSubject(
  prisma: PrismaClient,
  teacherId: string,
  subjectId: string,
) {
  return prisma.teacherSubject.create({ data: { teacherId, subjectId } });
}

/**
 * Vincula professor a uma turma + disciplina (TeacherClass).
 */
export async function assignTeacherToClass(
  prisma: PrismaClient,
  {
    teacherId,
    classId,
    subjectId,
    isHomeroom = false,
  }: {
    teacherId: string;
    classId: string;
    subjectId: string;
    isHomeroom?: boolean;
  },
) {
  return prisma.teacherClass.create({
    data: { teacherId, classId, subjectId, isHomeroom },
  });
}

// ── Admin user helper ─────────────────────────────────────────────────────────

/** Cria um SCHOOL_ADMIN e retorna o JwtPayload simulado — útil em testes de controller */
export function makeJwtPayload(
  userId: string,
  schoolId: string,
  role: string = 'SCHOOL_ADMIN',
) {
  return {
    sub: userId,
    email: `admin${_userCounter}@test.com`,
    role,
    schoolId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  };
}
