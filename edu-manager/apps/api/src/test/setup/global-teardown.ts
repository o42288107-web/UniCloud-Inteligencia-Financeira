/**
 * global-teardown.ts
 * Executado UMA VEZ após todos os testes de integração.
 * Em CI não precisamos limpar — o container é destruído.
 * Localmente faz TRUNCATE em cascata para deixar o banco limpo.
 */
import { PrismaClient } from '@edu-manager/database';

export default async function globalTeardown() {
  if (process.env.CI) return; // CI: container morre, não precisa limpar

  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL } },
  });

  try {
    // Tabelas em ordem inversa de dependência (FK)
    const tables = [
      'ai_messages', 'ai_conversations', 'occurrence_notifications',
      'occurrence_files', 'occurrences', 'attendances', 'grades',
      'assessments', 'class_diaries', 'lesson_plans', 'class_schedules',
      'stock_movements', 'stock_items', 'meal_plan_items', 'meal_plans',
      'food_inventory', 'food_items', 'assets', 'internal_requests',
      'tasks', 'announcements', 'notifications', 'messages',
      'student_documents', 'student_guardians', 'guardians',
      'enrollments', 'students', 'teacher_classes', 'teacher_subjects',
      'teachers', 'sessions', 'users', 'class_schedules',
      'classes', 'subjects', 'grade_levels', 'academic_years',
      'schools', 'dre',
    ];

    await prisma.$transaction(
      tables.map((t) => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE`)),
    );
    console.log('[test-teardown] Banco limpo.');
  } finally {
    await prisma.$disconnect();
  }
}
