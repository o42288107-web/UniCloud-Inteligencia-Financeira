// ─── Pagination ───────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
}

// ─── API Response ─────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}

// ─── User Roles ───────────────────────────────────────────────
export const UserRoles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
  COORDINATOR: 'COORDINATOR',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
  DRE_MANAGER: 'DRE_MANAGER',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

// ─── Auth ─────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: UserRole;
  schoolId?: string;
  dreId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId?: string;
  avatarUrl?: string;
}

// ─── Student ──────────────────────────────────────────────────
export interface StudentSummary {
  id: string;
  enrollmentNo: string;
  name: string;
  email: string;
  birthDate: string;
  gender: string;
  photoUrl?: string;
  activeClass?: {
    id: string;
    name: string;
    gradeLevel: string;
  };
}

// ─── Constants ────────────────────────────────────────────────
export const SHIFTS = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  EVENING: 'Noite',
} as const;

export const GRADE_STAGES = {
  FUNDAMENTAL_I: 'Ensino Fundamental I (1º-5º ano)',
  FUNDAMENTAL_II: 'Ensino Fundamental II (6º-9º ano)',
  MEDIO: 'Ensino Médio',
  EJA: 'EJA',
} as const;

export const RELATIONSHIPS = {
  PAI: 'Pai',
  MAE: 'Mãe',
  AVO_PATERNO: 'Avô Paterno',
  AVO_MATERNA: 'Avó Materna',
  TIO: 'Tio/Tia',
  IRMAO: 'Irmão/Irmã',
  RESPONSAVEL: 'Responsável Legal',
  OUTRO: 'Outro',
} as const;
