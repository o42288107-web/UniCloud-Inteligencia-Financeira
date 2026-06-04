import { createHash } from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload, AuthUser } from '@edu-manager/shared';
import { LoginDto } from './dto/login.dto';
import { RegisterSchoolDto } from './dto/register-school.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValid = await argon2.verify(user.password, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(user),
      this.createRefreshToken(user.id, dto.userAgent, dto.ipAddress),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as AuthUser['role'],
        schoolId: user.schoolId ?? undefined,
        avatarUrl: user.avatarUrl ?? undefined,
      },
    };
  }

  async refreshToken(token: string): Promise<{ accessToken: string }> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken: this.hashToken(token) },
      include: { user: true },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      // Possible token replay attack — revoke all sessions for this user
      if (session) {
        await this.prisma.session.updateMany({
          where: { userId: session.userId },
          data: { isRevoked: true },
        });
      }
      throw new UnauthorizedException('Token de atualização inválido');
    }

    if (!session.user.isActive || session.user.deletedAt) {
      throw new UnauthorizedException('Usuário inativo');
    }

    const accessToken = await this.generateAccessToken(session.user);
    return { accessToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshToken: this.hashToken(refreshToken) },
      data: { isRevoked: true },
    });
  }

  async registerSchool(dto: RegisterSchoolDto): Promise<{ message: string }> {
    const existingSchool = await this.prisma.school.findUnique({
      where: { cnpj: dto.cnpj },
    });
    if (existingSchool) {
      throw new ConflictException('CNPJ já cadastrado');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const hashedPassword = await argon2.hash(dto.adminPassword);

    await this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: dto.schoolName,
          cnpj: dto.cnpj,
          phone: dto.phone,
          email: dto.adminEmail.toLowerCase(),
        },
      });

      await tx.user.create({
        data: {
          schoolId: school.id,
          email: dto.adminEmail.toLowerCase(),
          password: hashedPassword,
          name: dto.adminName,
          role: 'SCHOOL_ADMIN',
        },
      });

      const currentYear = new Date().getFullYear();
      await tx.academicYear.create({
        data: {
          schoolId: school.id,
          year: currentYear,
          startDate: new Date(`${currentYear}-02-01`),
          endDate: new Date(`${currentYear}-12-15`),
          isCurrent: true,
        },
      });
    });

    return { message: 'Escola cadastrada com sucesso. Faça login para continuar.' };
  }

  private async generateAccessToken(user: {
    id: string;
    email: string;
    role: string;
    schoolId: string | null;
    dreId: string | null;
  }): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      schoolId: user.schoolId ?? undefined,
      dreId: user.dreId ?? undefined,
    };
    return this.jwt.signAsync(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      secret: this.config.getOrThrow('JWT_SECRET'),
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createRefreshToken(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: { userId, refreshToken: this.hashToken(token), userAgent, ipAddress, expiresAt },
    });

    return token;
  }
}
