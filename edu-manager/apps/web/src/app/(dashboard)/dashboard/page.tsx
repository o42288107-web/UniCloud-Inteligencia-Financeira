import { Users, UserCheck, AlertTriangle, BookOpen, TrendingUp, GraduationCap } from 'lucide-react';

const stats = [
  { label: 'Total de Alunos', value: '—', icon: Users, color: 'blue', change: null },
  { label: 'Professores Ativos', value: '—', icon: UserCheck, color: 'green', change: null },
  { label: 'Turmas', value: '—', icon: GraduationCap, color: 'purple', change: null },
  { label: 'Ocorrências (mês)', value: '—', icon: AlertTriangle, color: 'amber', change: null },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral da escola</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <div className={`p-2 rounded-lg bg-${stat.color}-50`}>
                  <Icon className={`w-5 h-5 text-${stat.color}-600`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Placeholder content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">Frequência da Semana</h2>
          </div>
          <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-400">Gráfico disponível após configuração</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-gray-800">Últimas Ocorrências</h2>
          </div>
          <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-400">Nenhuma ocorrência recente</p>
          </div>
        </div>
      </div>
    </div>
  );
}
