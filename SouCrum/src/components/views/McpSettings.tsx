import { useState } from 'react'
import type { CSSProperties } from 'react'
import { buildMcpConfig, useMcpSettings } from '../../hooks/useMcpSettings'
import type { McpServices } from '../../hooks/useMcpSettings'

const cardStyle: CSSProperties = {
  background: 'var(--bg-card)',
  border: 'var(--card-border)',
  boxShadow: 'var(--card-shadow)',
  borderRadius: 18,
  padding: 24,
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  border: '1px solid var(--border)',
  borderRadius: 11,
  fontSize: 13.5,
  color: 'var(--text-1)',
  background: 'var(--bg-app)',
  outline: 'none',
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-3)',
  marginBottom: 6,
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      role="switch"
      aria-checked={on}
      style={{
        width: 40,
        height: 23,
        borderRadius: 20,
        background: on ? 'var(--accent)' : 'var(--bg-hover)',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background .15s ease',
      }}
    >
      <div
        style={{
          width: 17,
          height: 17,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: on ? 20 : 3,
          transition: 'left .15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        }}
      />
    </div>
  )
}

const servicos: { key: keyof McpServices; label: string; desc: string }[] = [
  { key: 'notion', label: 'Notion', desc: 'Criar e ler páginas e bancos de dados' },
  { key: 'googleCalendar', label: 'Google Calendar', desc: 'Agendar cartões com prazo como eventos' },
  { key: 'gmail', label: 'Gmail', desc: 'Transformar e-mails em cartões' },
  { key: 'googleDrive', label: 'Google Drive', desc: 'Exportar projetos como documentos' },
]

export function McpSettings() {
  const { settings, update, toggleService, reset } = useMcpSettings()
  const [mostrarChave, setMostrarChave] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const configurado = settings.supabaseUrl.trim() !== '' && settings.publishableKey.trim() !== ''
  // service_role tem "role":"service_role" no payload; a publicável começa com sb_publishable_.
  const chaveArriscada = /service_role/i.test(settings.publishableKey)
  const config = buildMcpConfig(settings)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(config)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <>
      {/* Conexão */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Conexão MCP</div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 20,
              background: configurado ? 'var(--accent-soft)' : 'var(--bg-hover)',
              color: configurado ? 'var(--accent-strong)' : 'var(--text-3)',
            }}
          >
            {configurado ? 'Configurado' : 'Não configurado'}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 18, lineHeight: 1.5 }}>
          Permite que assistentes de IA (Claude, Gemini) leiam e atualizem seus cartões, projetos e
          rotinas. O servidor roda na sua máquina — estes dados ficam salvos apenas neste navegador.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={labelStyle}>URL do Supabase</div>
            <input
              value={settings.supabaseUrl}
              onChange={(e) => update('supabaseUrl', e.target.value)}
              placeholder="https://seu-projeto.supabase.co"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
              <span>Chave publicável (anon)</span>
              <span
                onClick={() => setMostrarChave((v) => !v)}
                style={{ cursor: 'pointer', color: 'var(--violet)', fontWeight: 600 }}
              >
                {mostrarChave ? 'Ocultar' : 'Mostrar'}
              </span>
            </div>
            <input
              type={mostrarChave ? 'text' : 'password'}
              value={settings.publishableKey}
              onChange={(e) => update('publishableKey', e.target.value)}
              placeholder="sb_publishable_..."
              autoComplete="off"
              spellCheck={false}
              style={{
                ...inputStyle,
                borderColor: chaveArriscada ? 'var(--accent)' : 'var(--border)',
              }}
            />
            {chaveArriscada && (
              <div
                style={{
                  marginTop: 8,
                  padding: '10px 12px',
                  borderRadius: 11,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-strong)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                ⚠️ Isso parece uma chave <strong>service_role</strong>. Ela ignora as regras de acesso
                e dá controle total do banco — não guarde no navegador. Use a chave publicável (anon).
              </div>
            )}
          </div>

          <div>
            <div style={labelStyle}>Caminho do servidor MCP</div>
            <input
              value={settings.serverPath}
              onChange={(e) => update('serverPath', e.target.value)}
              placeholder="/caminho/para/soucrum-mcp/dist/index.js"
              spellCheck={false}
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>Somente leitura</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                O assistente consulta, mas não cria nem altera nada
              </div>
            </div>
            <Toggle on={settings.readOnly} onClick={() => update('readOnly', !settings.readOnly)} />
          </div>
        </div>
      </div>

      {/* Serviços conectados */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
          Serviços conectados
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.5 }}>
          Habilite os serviços que o assistente pode usar junto com o SouCrum. Cada um entra como um
          servidor MCP próprio e pede as credenciais dele.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {servicos.map((s) => (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 4px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>{s.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.desc}</div>
              </div>
              <Toggle on={settings.services[s.key]} onClick={() => toggleService(s.key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Configuração gerada */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Configuração para colar</div>
          <button
            onClick={copiar}
            style={{
              background: copiado ? 'var(--accent-soft)' : 'var(--accent)',
              color: copiado ? 'var(--accent-strong)' : '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
              transition: 'background .15s ease',
            }}
          >
            {copiado ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
          Claude Desktop: <code>claude_desktop_config.json</code> · Gemini CLI:{' '}
          <code>~/.gemini/settings.json</code> · Cursor: <code>~/.cursor/mcp.json</code>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 16,
            background: 'var(--bg-app)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            fontSize: 12,
            lineHeight: 1.55,
            color: 'var(--text-2)',
            overflowX: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {config}
        </pre>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 14,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Os tokens do Notion e do Google são preenchidos por você no arquivo.
          </span>
          <button
            onClick={reset}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              padding: '7px 14px',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            Limpar
          </button>
        </div>
      </div>
    </>
  )
}
