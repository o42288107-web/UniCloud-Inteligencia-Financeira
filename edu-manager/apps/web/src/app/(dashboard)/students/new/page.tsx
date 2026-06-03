'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { studentsApi } from '@/lib/api';
import { ArrowLeft, Plus, Trash2, Loader2, User, Users, FileText } from 'lucide-react';
import Link from 'next/link';

const guardianSchema = z.object({
  name: z.string().min(3, 'Nome obrigatório'),
  phone: z.string().min(10, 'Telefone inválido'),
  relationship: z.string().min(1, 'Parentesco obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
  hasAppAccess: z.boolean().optional(),
});

const schema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  birthDate: z.string().min(1, 'Data de nascimento obrigatória'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Selecione o gênero' }),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  bloodType: z.string().optional(),
  nationality: z.string().optional(),
  birthCity: z.string().optional(),
  birthState: z.string().optional(),
  susCard: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    number: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
  }).optional(),
  guardians: z.array(guardianSchema).optional(),
});

type FormData = z.infer<typeof schema>;

const tabs = [
  { id: 'personal', label: 'Dados Pessoais', icon: User },
  { id: 'guardians', label: 'Responsáveis', icon: Users },
  { id: 'documents', label: 'Documentos', icon: FileText },
];

export default function NewStudentPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('personal');

  const {
    register, handleSubmit, control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { guardians: [] },
  });

  const { fields: guardians, append, remove } = useFieldArray({ control, name: 'guardians' });

  const mutation = useMutation({
    mutationFn: (data: FormData) => studentsApi.create(data as any),
    onSuccess: (student) => {
      toast.success('Aluno cadastrado com sucesso!');
      router.push(`/dashboard/students/${student.id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? 'Erro ao cadastrar aluno';
      toast.error(msg);
    },
  });

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/students"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cadastrar Aluno</h1>
          <p className="text-sm text-gray-500">Preencha os dados do novo aluno</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        {/* Personal Data */}
        {activeTab === 'personal' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-4">Informações Pessoais</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                  <input
                    {...register('name')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="João Pedro da Silva"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="joao@escola.com.br"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento *</label>
                  <input
                    {...register('birthDate')}
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gênero *</label>
                  <select
                    {...register('gender')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecionar...</option>
                    <option value="MALE">Masculino</option>
                    <option value="FEMALE">Feminino</option>
                    <option value="OTHER">Outro</option>
                  </select>
                  {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  <input
                    {...register('cpf')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                  <input
                    {...register('rg')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo sanguíneo</label>
                  <select
                    {...register('bloodType')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Não informado</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cartão SUS</label>
                  <input
                    {...register('susCard')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-4">Endereço</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                  <input
                    {...register('address.street')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Rua das Flores"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                  <input {...register('address.number')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                  <input {...register('address.neighborhood')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                  <input {...register('address.city')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                  <input {...register('address.zipCode')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="00000-000" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Guardians */}
        {activeTab === 'guardians' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">Responsáveis</h2>
              <button
                type="button"
                onClick={() => append({ name: '', phone: '', relationship: '', email: '', isPrimary: false, hasAppAccess: false })}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Adicionar responsável
              </button>
            </div>

            {guardians.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nenhum responsável adicionado</p>
                <button
                  type="button"
                  onClick={() => append({ name: '', phone: '', relationship: '', email: '' })}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  Adicionar primeiro responsável
                </button>
              </div>
            )}

            <div className="space-y-4">
              {guardians.map((field, index) => (
                <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700">Responsável {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo *</label>
                      <input
                        {...register(`guardians.${index}.name`)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Telefone *</label>
                      <input
                        {...register(`guardians.${index}.phone`)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="(11) 98765-4321"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Parentesco *</label>
                      <select
                        {...register(`guardians.${index}.relationship`)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecionar...</option>
                        <option value="PAI">Pai</option>
                        <option value="MAE">Mãe</option>
                        <option value="AVO_PATERNO">Avô/Avó Paterno</option>
                        <option value="AVO_MATERNA">Avô/Avó Materno</option>
                        <option value="TIO">Tio/Tia</option>
                        <option value="IRMAO">Irmão/Irmã</option>
                        <option value="RESPONSAVEL">Responsável Legal</option>
                        <option value="OUTRO">Outro</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                      <input
                        {...register(`guardians.${index}.email`)}
                        type="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" {...register(`guardians.${index}.isPrimary`)} className="rounded" />
                        Contato principal
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" {...register(`guardians.${index}.hasAppAccess`)} className="rounded" />
                        Acesso ao portal
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents tab placeholder */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Documentos</h2>
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Upload de documentos disponível após o cadastro</p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between mt-6">
          <Link href="/dashboard/students" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </Link>
          <div className="flex items-center gap-3">
            {activeTab !== 'documents' && (
              <button
                type="button"
                onClick={() => {
                  const order = ['personal','guardians','documents'];
                  const next = order[order.indexOf(activeTab) + 1];
                  if (next) setActiveTab(next);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Próximo
              </button>
            )}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {mutation.isPending ? 'Salvando...' : 'Cadastrar Aluno'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
