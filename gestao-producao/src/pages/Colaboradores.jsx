import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const FORM_VAZIO = { nome: '', setor: '', funcao: '', unidade_id: '' }

export default function Colaboradores() {
  const [colaboradores, setColaboradores] = useState([])
  const [unidades, setUnidades] = useState([])
  const [form, setForm] = useState(FORM_VAZIO)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState(null)

  const carregar = () =>
    supabase
      .from('colaboradores')
      .select('*, unidades(nome)')
      .order('nome')
      .then(({ data }) => setColaboradores(data ?? []))

  useEffect(() => {
    carregar()
    supabase.from('unidades').select('*').order('id').then(({ data }) => setUnidades(data ?? []))
  }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase.from('colaboradores').insert({
      nome: form.nome,
      setor: form.setor || null,
      funcao: form.funcao || null,
      unidade_id: form.unidade_id ? Number(form.unidade_id) : null,
    })
    if (error) {
      setErro(error.message)
      return
    }
    setForm(FORM_VAZIO)
    setAberto(false)
    carregar()
  }

  async function alternarAtivo(c) {
    await supabase.from('colaboradores').update({ ativo: !c.ativo }).eq('id', c.id)
    carregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Equipe (colaboradores)</h1>
        <button className="btn-primary" onClick={() => setAberto(!aberto)}>
          {aberto ? 'Fechar' : '+ Novo colaborador'}
        </button>
      </div>

      {aberto && (
        <form onSubmit={salvar} className="card mb-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome</label>
            <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Setor</label>
            <input className="input" value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Corte, Pesponto…" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Função</label>
            <input className="input" value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} placeholder="Operador…" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Unidade</label>
            <select className="input" value={form.unidade_id} onChange={(e) => setForm({ ...form, unidade_id: e.target.value })} required>
              <option value="">— selecionar —</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
          {erro && <p className="text-sm font-medium text-terra sm:col-span-2 lg:col-span-4">{erro}</p>}
          <div className="sm:col-span-2 lg:col-span-4">
            <button className="btn-primary">Salvar colaborador</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto !border-t-0 p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="bg-navy text-left text-warm">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Setor</th>
              <th className="px-4 py-3 font-medium">Função</th>
              <th className="px-4 py-3 font-medium">Unidade</th>
              <th className="px-4 py-3 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c) => (
              <tr key={c.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-medium">{c.nome}</td>
                <td className="px-4 py-3">{c.setor ?? '—'}</td>
                <td className="px-4 py-3">{c.funcao ?? '—'}</td>
                <td className="px-4 py-3">{c.unidades?.nome ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => alternarAtivo(c)}
                    className={`text-xs font-semibold underline-offset-2 hover:underline ${c.ativo ? 'text-green-700' : 'text-[--text-faint]'}`}
                  >
                    {c.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
              </tr>
            ))}
            {colaboradores.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[--text-muted]">Nenhum colaborador cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
