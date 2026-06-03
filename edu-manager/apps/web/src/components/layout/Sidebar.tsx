'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, UserCheck, BookOpen, ClipboardList,
  Bell, MessageSquare, Utensils, Package, BarChart3, Brain,
  GraduationCap, Settings, ChevronRight, AlertTriangle,
} from 'lucide-react';

const nav = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Alunos',
    icon: Users,
    children: [
      { label: 'Cadastro de Alunos', href: '/dashboard/students' },
      { label: 'Portal do Aluno', href: '/dashboard/student-portal' },
      { label: 'Portal dos Pais', href: '/dashboard/parent-portal' },
    ],
  },
  {
    label: 'Professores',
    icon: UserCheck,
    children: [
      { label: 'Cadastro', href: '/dashboard/teachers' },
      { label: 'Diário de Classe', href: '/dashboard/diario' },
      { label: 'Plano de Aula', href: '/dashboard/lesson-plans' },
      { label: 'Assistente IA', href: '/dashboard/teacher-ai' },
    ],
  },
  {
    label: 'Pedagógico',
    icon: BookOpen,
    children: [
      { label: 'Turmas', href: '/dashboard/classes' },
      { label: 'Avaliações', href: '/dashboard/assessments' },
      { label: 'Boletins', href: '/dashboard/report-cards' },
    ],
  },
  { label: 'Ocorrências', href: '/dashboard/occurrences', icon: AlertTriangle },
  {
    label: 'Comunicação',
    icon: MessageSquare,
    children: [
      { label: 'Comunicados', href: '/dashboard/announcements' },
      { label: 'Mensagens', href: '/dashboard/messages' },
      { label: 'Notificações', href: '/dashboard/notifications' },
    ],
  },
  {
    label: 'Merenda (PNAE)',
    icon: Utensils,
    children: [
      { label: 'Cardápios', href: '/dashboard/meal-plans' },
      { label: 'Estoque', href: '/dashboard/food-inventory' },
    ],
  },
  {
    label: 'Patrimônio',
    icon: Package,
    children: [
      { label: 'Inventário', href: '/dashboard/assets' },
      { label: 'Almoxarifado', href: '/dashboard/stock' },
    ],
  },
  { label: 'CRM Escolar', href: '/dashboard/crm', icon: ClipboardList },
  { label: 'IA & Analytics', href: '/dashboard/analytics', icon: Brain },
  { label: 'Configurações', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-700">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm">EduManager</p>
          <p className="text-xs text-gray-400">Gestão Escolar</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {nav.map((item) =>
          item.children ? (
            <NavGroup key={item.label} item={item} pathname={pathname} />
          ) : (
            <NavItem key={item.href} item={item} pathname={pathname} />
          ),
        )}
      </nav>
    </aside>
  );
}

function NavItem({ item, pathname }: { item: any; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-800 hover:text-white',
      )}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      <span>{item.label}</span>
    </Link>
  );
}

function NavGroup({ item, pathname }: { item: any; pathname: string }) {
  const Icon = item.icon;
  const isGroupActive = item.children.some((c: any) => pathname.startsWith(c.href));

  return (
    <details open={isGroupActive} className="group">
      <summary className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition list-none',
        isGroupActive ? 'text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
      )}>
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
        <span className="flex-1">{item.label}</span>
        <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
      </summary>
      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-700 pl-3">
        {item.children.map((child: any) => {
          const isActive = pathname === child.href || pathname.startsWith(child.href + '/');
          return (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                'block px-3 py-1.5 rounded text-xs transition',
                isActive
                  ? 'text-blue-400 font-medium'
                  : 'text-gray-400 hover:text-white',
              )}
            >
              {child.label}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
