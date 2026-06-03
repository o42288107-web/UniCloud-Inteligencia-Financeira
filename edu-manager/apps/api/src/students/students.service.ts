import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '@edu-manager/shared';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentQueryDto } from './dto/student-query.dto';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, query: StudentQueryDto) {
    const { page = 1, limit = 20, search, classId, status, sort } = query;
    const skip = (page - 1) * limit;

    const [field, order] = sort ? sort.split(':') : ['name', 'asc'];

    const where = {
      schoolId,
      deletedAt: null,
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' as const } } },
          { enrollmentNo: { contains: search, mode: 'insensitive' as const } },
          { user: { email: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(classId && {
        enrollments: { some: { classId, status: 'ACTIVE' } },
      }),
    };

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: field === 'name' ? { user: { name: order as 'asc' | 'desc' } } : { createdAt: order as 'asc' | 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, isActive: true } },
          enrollments: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: { class: { include: { gradeLevel: true } } },
          },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: students.map(this.formatStudent),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, isActive: true, phone: true } },
        enrollments: {
          orderBy: { enrolledAt: 'desc' },
          include: { class: { include: { gradeLevel: true, academicYear: true } } },
        },
        guardians: { include: { guardian: true } },
        documents: true,
      },
    });

    if (!student) throw new NotFoundException('Aluno não encontrado');
    return student;
  }

  async create(dto: CreateStudentDto, currentUser: JwtPayload) {
    const schoolId = currentUser.schoolId!;

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) throw new ConflictException('E-mail já cadastrado');

    const enrollmentNo = dto.enrollmentNo ?? await this.generateEnrollmentNo(schoolId);

    const existing = await this.prisma.student.findUnique({
      where: { schoolId_enrollmentNo: { schoolId, enrollmentNo } },
    });
    if (existing) throw new ConflictException('Número de matrícula já existe');

    const tempPassword = await argon2.hash(
      `${dto.name.split(' ')[0].toLowerCase()}@${new Date(dto.birthDate).getFullYear()}`,
    );

    const student = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId,
          email: dto.email.toLowerCase(),
          password: tempPassword,
          name: dto.name,
          role: 'STUDENT',
        },
      });

      const newStudent = await tx.student.create({
        data: {
          userId: user.id,
          schoolId,
          enrollmentNo,
          birthDate: new Date(dto.birthDate),
          gender: dto.gender as any,
          cpf: dto.cpf,
          rg: dto.rg,
          bloodType: dto.bloodType,
          nationality: dto.nationality ?? 'Brasileira',
          birthCity: dto.birthCity,
          birthState: dto.birthState,
          address: dto.address,
          specialNeeds: dto.specialNeeds,
          medicalInfo: dto.medicalInfo,
          susCard: dto.susCard,
        },
      });

      // Matricular na turma se informada
      if (dto.classId) {
        const classData = await tx.class.findFirst({
          where: { id: dto.classId, schoolId },
          include: { academicYear: { where: { isCurrent: true } } },
        });
        if (classData?.academicYear) {
          await tx.enrollment.create({
            data: {
              studentId: newStudent.id,
              classId: dto.classId,
              academicYearId: classData.academicYear.id,
              schoolId,
            },
          });
        }
      }

      // Vincular responsáveis
      if (dto.guardians?.length) {
        for (const g of dto.guardians) {
          const guardian = await tx.guardian.create({
            data: {
              schoolId,
              name: g.name,
              phone: g.phone,
              email: g.email?.toLowerCase(),
              cpf: g.cpf,
              relationship: g.relationship,
            },
          });
          await tx.studentGuardian.create({
            data: {
              studentId: newStudent.id,
              guardianId: guardian.id,
              relationship: g.relationship,
              isPrimary: g.isPrimary ?? false,
              hasAppAccess: g.hasAppAccess ?? false,
            },
          });
        }
      }

      return newStudent;
    });

    return this.findOne(student.id, schoolId);
  }

  async update(id: string, dto: UpdateStudentDto, currentUser: JwtPayload) {
    const schoolId = currentUser.schoolId!;
    await this.ensureExists(id, schoolId);

    await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (dto.name || dto.email) {
        await tx.user.update({
          where: { id: student!.userId },
          data: {
            ...(dto.name && { name: dto.name }),
            ...(dto.email && { email: dto.email.toLowerCase() }),
          },
        });
      }

      await tx.student.update({
        where: { id },
        data: {
          ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
          ...(dto.gender && { gender: dto.gender as any }),
          ...(dto.cpf !== undefined && { cpf: dto.cpf }),
          ...(dto.rg !== undefined && { rg: dto.rg }),
          ...(dto.bloodType !== undefined && { bloodType: dto.bloodType }),
          ...(dto.address && { address: dto.address }),
          ...(dto.specialNeeds && { specialNeeds: dto.specialNeeds }),
          ...(dto.medicalInfo && { medicalInfo: dto.medicalInfo }),
          ...(dto.susCard !== undefined && { susCard: dto.susCard }),
        },
      });
    });

    return this.findOne(id, schoolId);
  }

  async remove(id: string, currentUser: JwtPayload) {
    const schoolId = currentUser.schoolId!;
    await this.ensureExists(id, schoolId);

    await this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async enroll(studentId: string, classId: string, currentUser: JwtPayload) {
    const schoolId = currentUser.schoolId!;
    await this.ensureExists(studentId, schoolId);

    const currentYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!currentYear) throw new NotFoundException('Ano letivo atual não configurado');

    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId: currentYear.id } },
    });
    if (existing) {
      if (existing.status === 'ACTIVE') throw new ConflictException('Aluno já matriculado no ano letivo atual');
      return this.prisma.enrollment.update({
        where: { id: existing.id },
        data: { classId, status: 'ACTIVE', transferredAt: null },
        include: { class: { include: { gradeLevel: true } } },
      });
    }

    return this.prisma.enrollment.create({
      data: { studentId, classId, academicYearId: currentYear.id, schoolId },
      include: { class: { include: { gradeLevel: true } } },
    });
  }

  async getGrades(studentId: string, currentUser: JwtPayload) {
    const schoolId = currentUser.schoolId!;
    await this.ensureExists(studentId, schoolId);

    return this.prisma.grade.findMany({
      where: { studentId },
      include: {
        assessment: {
          include: { subject: true, class: { include: { gradeLevel: true } } },
        },
      },
      orderBy: { assessment: { scheduledAt: 'desc' } },
    });
  }

  async getAttendance(studentId: string, currentUser: JwtPayload) {
    const schoolId = currentUser.schoolId!;
    await this.ensureExists(studentId, schoolId);

    return this.prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  private async ensureExists(id: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');
    return student;
  }

  private async generateEnrollmentNo(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.student.count({ where: { schoolId } });
    return `${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private formatStudent(s: any) {
    return {
      id: s.id,
      enrollmentNo: s.enrollmentNo,
      name: s.user.name,
      email: s.user.email,
      avatarUrl: s.user.avatarUrl,
      isActive: s.user.isActive,
      birthDate: s.birthDate,
      gender: s.gender,
      activeClass: s.enrollments?.[0]
        ? {
            id: s.enrollments[0].class.id,
            name: s.enrollments[0].class.name,
            gradeLevel: s.enrollments[0].class.gradeLevel.name,
          }
        : null,
    };
  }
}
