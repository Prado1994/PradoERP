import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha inválidos.')
    setEnviando(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy p-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-terra text-2xl font-semibold text-white">
          P
        </div>
        <div>
          <div className="text-xl font-semibold text-warm">Grupo Prado</div>
          <div className="text-sm italic text-beige">Feitos para durar</div>
        </div>
      </div>

      <form onSubmit={entrar} className="card w-full max-w-sm p-6">
        <h1 className="mb-4 text-lg font-semibold">Gestão de Produção</h1>
        <label className="mb-1 block text-sm font-medium">E-mail</label>
        <input
          className="input mb-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <label className="mb-1 block text-sm font-medium">Senha</label>
        <input
          className="input mb-4"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
        />
        {erro && <p className="mb-3 text-sm font-medium text-terra">{erro}</p>}
        <button className="btn-primary w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-8 text-center text-[11px] text-beige">
        Grupo Prado · Safety Prado · Country Prado · Itanhandu &amp; Guaxupé
      </p>
    </div>
  )
}
