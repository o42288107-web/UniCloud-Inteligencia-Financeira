import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentQueryDto } from './dto/student-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '@edu-manager/shared';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private students: StudentsService) {}

  @Get()
  @Roles('SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER')
  @ApiOperation({ summary: 'Listar alunos' })
  findAll(@Query() query: StudentQueryDto, @CurrentUser() user: JwtPayload) {
    return this.students.findAll(user.schoolId!, query);
  }

  @Get(':id')
  @Roles('SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER')
  @ApiOperation({ summary: 'Detalhar aluno' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<any> {
    return this.students.findOne(id, user.schoolId!);
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'COORDINATOR')
  @ApiOperation({ summary: 'Cadastrar aluno' })
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: JwtPayload): Promise<any> {
    return this.students.create(dto, user);
  }

  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'COORDINATOR')
  @ApiOperation({ summary: 'Atualizar aluno' })
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @CurrentUser() user: JwtPayload): Promise<any> {
    return this.students.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('SCHOOL_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativar aluno' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.students.remove(id, user);
  }

  @Post(':id/enroll')
  @Roles('SCHOOL_ADMIN', 'COORDINATOR')
  @ApiOperation({ summary: 'Matricular aluno em turma' })
  enroll(
    @Param('id') id: string,
    @Body('classId') classId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.students.enroll(id, classId, user);
  }

  @Get(':id/grades')
  @Roles('SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER')
  @ApiOperation({ summary: 'Notas do aluno' })
  getGrades(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<any> {
    return this.students.getGrades(id, user);
  }

  @Get(':id/attendance')
  @Roles('SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER')
  @ApiOperation({ summary: 'Frequência do aluno' })
  getAttendance(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.students.getAttendance(id, user);
  }
}
