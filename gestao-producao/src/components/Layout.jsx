import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const links = [
  { to: '/apontar', label: 'Apontar', papeis: ['operador', 'supervisor', 'gestao'] },
  { to: '/', label: 'Painel', papeis: ['supervisor', 'gestao'] },
  { to: '/dashboard', label: 'Dashboard', papeis: ['supervisor', 'gestao'] },
  { to: '/planos', label: 'Planos', papeis: ['supervisor', 'gestao'] },
  { to: '/pedidos', label: 'Pedidos', papeis: ['supervisor', 'gestao'] },
  { to: '/ops', label: 'OPs', papeis: ['supervisor', 'gestao'] },
  { to: '/modelos', label: 'Modelos', papeis: ['supervisor', 'gestao'] },
  { to: '/colaboradores', label: 'Equipe', papeis: ['supervisor', 'gestao'] },
]

export default function Layout() {
  const { profile, papel } = useAuth()
  const visiveis = links.filter((l) => l.papeis.includes(papel))

  return (
    <div className="min-h-screen pb-16">
      <header className="no-print bg-navy text-warm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-terra text-lg font-semibold text-white">
            P
          </div>
          <div className="flex-1">
            <div className="text-[17px] font-semibold leading-tight">Grupo Prado</div>
            <div className="text-xs italic text-beige">Gestão de Produção por Ficha</div>
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-yellow">{profile?.nome ?? ''}</div>
            <div className="text-xs text-beige capitalize">
              {papel}
              {profile?.unidades?.nome ? ` · ${profile.unidades.nome}` : ''}
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-[7px] border border-beige/40 px-3 py-1.5 text-xs text-beige hover:bg-blue"
          >
            Sair
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {visiveis.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-[7px] px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-yellow text-navy' : 'text-beige hover:bg-blue'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="no-print fixed bottom-0 left-0 right-0 border-t border-black/10 bg-[--bg] py-2 text-center text-[11px] text-[--text-faint]">
        Grupo Prado · Safety Prado · Country Prado · Itanhandu &amp; Guaxupé · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
