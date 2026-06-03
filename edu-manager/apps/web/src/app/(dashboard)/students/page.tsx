'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '@/lib/api';
import {
  Search, Plus, Filter, Download, MoreHorizontal,
  UserCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function StudentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, search],
    queryFn: () => studentsApi.list({ page, limit: 20, search: search || undefined }),
  });

  const students = data?.data ?? [];
  const pagination = data?.pagination;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alunos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination?.total ?? '—'} alunos cadastrados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <Link
            href="/dashboard/students/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Novo Aluno
          </Link>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, matrícula..."
            className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400"
          />
        </form>
        <div className="h-5 w-px bg-gray-200" />
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <Filter className="w-4 h-4" />
          Filtros
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">
                Aluno
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                Matrícula
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                Turma
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                Nascimento
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                Status
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : students.map((s: any) => <StudentRow key={s.id} student={s} />)}
          </tbody>
        </table>

        {!isLoading && students.length === 0 && (
          <div className="text-center py-16">
            <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum aluno encontrado</p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? 'Tente outros termos de busca' : 'Cadastre o primeiro aluno'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} de{' '}
              {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm px-2">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.totalPages}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentRow({ student }: { student: any }) {
  return (
    <tr className="hover:bg-gray-50 transition">
      <td className="px-5 py-3">
        <Link href={`/dashboard/students/${student.id}`} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {student.name?.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 hover:text-blue-600">{student.name}</p>
            <p className="text-xs text-gray-400">{student.email}</p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600 font-mono">{student.enrollmentNo}</span>
      </td>
      <td className="px-4 py-3">
        {student.activeClass ? (
          <div>
            <p className="text-sm text-gray-700">{student.activeClass.name}</p>
            <p className="text-xs text-gray-400">{student.activeClass.gradeLevel}</p>
          </div>
        ) : (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            Sem turma
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600">
          {student.birthDate
            ? format(new Date(student.birthDate), 'dd/MM/yyyy', { locale: ptBR })
            : '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          student.isActive
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {student.isActive ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td className="px-4 py-3">
        <button className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}
