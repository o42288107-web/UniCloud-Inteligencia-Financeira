import { IsEmail, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterSchoolDto {
  @ApiProperty({ example: 'Escola Estadual João da Silva' })
  @IsString()
  @MinLength(3)
  schoolName: string;

  @ApiProperty({ example: '12.345.678/0001-90' })
  @IsString()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, { message: 'CNPJ inválido (formato: 00.000.000/0000-00)' })
  cnpj: string;

  @ApiProperty({ example: '(11) 3456-7890', required: false })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Maria Diretora' })
  @IsString()
  @MinLength(3)
  adminName: string;

  @ApiProperty({ example: 'diretora@escola.com.br' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'senha_segura_123' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  adminPassword: string;
}
