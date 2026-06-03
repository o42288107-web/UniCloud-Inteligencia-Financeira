import {
  IsString, IsEmail, IsDateString, IsEnum, IsOptional,
  IsObject, IsArray, ValidateNested, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuardianDto {
  @ApiProperty({ example: 'Maria da Silva' })
  @IsString()
  name: string;

  @ApiProperty({ example: '(11) 98765-4321' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'MAE' })
  @IsString()
  relationship: string;

  @ApiPropertyOptional({ example: 'maria@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  hasAppAccess?: boolean;
}

export class CreateStudentDto {
  @ApiProperty({ example: 'João Pedro da Silva' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'joao.pedro@escola.com.br' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '2010-05-15' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ enum: ['MALE', 'FEMALE', 'OTHER'] })
  @IsEnum(['MALE', 'FEMALE', 'OTHER'])
  gender: string;

  @ApiPropertyOptional({ example: '123.456.789-00' })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  address?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  specialNeeds?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  medicalInfo?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  susCard?: string;

  @ApiPropertyOptional({ example: 'EM-2025-001' })
  @IsOptional()
  @IsString()
  enrollmentNo?: string;

  @ApiPropertyOptional({ description: 'ID da turma para matrícula imediata' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ type: [CreateGuardianDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGuardianDto)
  guardians?: CreateGuardianDto[];
}
