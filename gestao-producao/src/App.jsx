import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { configurado } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Apontamento from './pages/Apontamento'
import Painel from './pages/Painel'
import Dashboard from './pages/Dashboard'
import Planos from './pages/Planos'
import PlanoDetalhe from './pages/PlanoDetalhe'
import Pedidos from './pages/Pedidos'
import Ops from './pages/Ops'
import OpDetalhe from './pages/OpDetalhe'
import FichaPrint from './pages/FichaPrint'
import Modelos from './pages/Modelos'
import Colaboradores from './pages/Colaboradores'

function TelaConfiguracao() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-lg p-8">
        <h1 className="mb-3 text-xl font-semibold">Configuração pendente</h1>
        <p className="text-[15px] text-[--text-muted]">
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no
          arquivo <code>.env</code> (veja <code>.env.example</code>) e reinicie o app.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const { session, loading, papel } = useAuth()

  if (!configurado) return <TelaConfiguracao />
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[--text-muted]">
        Carregando…
      </div>
    )
  }
  if (!session) return <Login />

  return (
    <Routes>
      <Route path="/fichas/:id/imprimir" element={<FichaPrint />} />
      <Route element={<Layout />}>
        <Route path="/" element={papel === 'operador' ? <Navigate to="/apontar" replace /> : <Painel />} />
        <Route path="/apontar" element={<Apontamento />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/planos" element={<Planos />} />
        <Route path="/planos/:id" element={<PlanoDetalhe />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/ops" element={<Ops />} />
        <Route path="/ops/:id" element={<OpDetalhe />} />
        <Route path="/modelos" element={<Modelos />} />
        <Route path="/colaboradores" element={<Colaboradores />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
