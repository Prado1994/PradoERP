import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const FORM_VAZIO = { codigo: '', nome: '', marca: 'Safety Prado', linha: '', grade_inicio: 34, grade_fim: 44 }

export default function Modelos() {
  const [modelos, setModelos] = useState([])
  const [form, setForm] = useState(FORM_VAZIO)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState(null)

  const carregar = () =>
    supabase.from('modelos').select('*').order('codigo').then(({ data }) => setModelos(data ?? []))

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase.from('modelos').insert({
      ...form,
      grade_inicio: Number(form.grade_inicio),
      grade_fim: Number(form.grade_fim),
      linha: form.linha || null,
    })
    if (error) {
      setErro(error.message)
      return
    }
    setForm(FORM_VAZIO)
    setAberto(false)
    carregar()
  }

  async function alternarAtivo(m) {
    await supabase.from('modelos').update({ ativo: !m.ativo }).eq('id', m.id)
    carregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Modelos / SKUs</h1>
        <button className="btn-primary" onClick={() => setAberto(!aberto)}>
          {aberto ? 'Fechar' : '+ Novo modelo'}
        </button>
      </div>

      {aberto && (
        <form onSubmit={salvar} className="card mb-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Código</label>
            <input className="input" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nome</label>
            <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Marca</label>
            <select className="input" value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })}>
              <option>Safety Prado</option>
              <option>Country Prado</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Linha</label>
            <input className="input" value={form.linha} onChange={(e) => setForm({ ...form, linha: e.target.value })} placeholder="Industrial, Agro…" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade — de</label>
            <input className="input" type="number" min="20" max="50" value={form.grade_inicio} onChange={(e) => setForm({ ...form, grade_inicio: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade — até</label>
            <input className="input" type="number" min="20" max="50" value={form.grade_fim} onChange={(e) => setForm({ ...form, grade_fim: e.target.value })} />
          </div>
          {erro && <p className="text-sm font-medium text-terra sm:col-span-2 lg:col-span-3">{erro}</p>}
          <div className="sm:col-span-2 lg:col-span-3">
            <button className="btn-primary">Salvar modelo</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto !border-t-0 p-0">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="bg-navy text-left text-warm">
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Marca</th>
              <th className="px-4 py-3 font-medium">Linha</th>
              <th className="px-4 py-3 font-medium">Grade</th>
              <th className="px-4 py-3 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {modelos.map((m) => (
              <tr key={m.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-semibold">{m.codigo}</td>
                <td className="px-4 py-3">{m.nome}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${m.marca === 'Safety Prado' ? 'badge-estrategico' : 'badge-operacional'}`}>
                    {m.marca}
                  </span>
                </td>
                <td className="px-4 py-3">{m.linha ?? '—'}</td>
                <td className="px-4 py-3">{m.grade_inicio}–{m.grade_fim}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => alternarAtivo(m)}
                    className={`text-xs font-semibold underline-offset-2 hover:underline ${m.ativo ? 'text-green-700' : 'text-[--text-faint]'}`}
                  >
                    {m.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
              </tr>
            ))}
            {modelos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[--text-muted]">Nenhum modelo cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
