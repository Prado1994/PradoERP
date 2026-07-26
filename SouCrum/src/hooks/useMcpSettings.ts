import { useCallback, useEffect, useState } from 'react'

export interface McpServices {
  notion: boolean
  googleCalendar: boolean
  gmail: boolean
  googleDrive: boolean
}

export interface McpSettings {
  /** URL do projeto Supabase que o servidor MCP consulta. */
  supabaseUrl: string
  /** Chave publicável/anon. Nunca guardar service_role aqui — ver aviso na UI. */
  publishableKey: string
  /** Caminho do servidor MCP na máquina do usuário. */
  serverPath: string
  /** Porta do endpoint /health local. 0 desliga a verificação de status. */
  healthPort: number
  /** Quando ligado, o assistente só lê — nenhuma ferramenta de escrita é exposta. */
  readOnly: boolean
  /** Serviços externos que o assistente pode alcançar junto com o SouCrum. */
  services: McpServices
}

const STORAGE_KEY = 'soucrum.mcp.settings'

export const defaultMcpSettings: McpSettings = {
  supabaseUrl: '',
  publishableKey: '',
  serverPath: '/caminho/para/soucrum-mcp/dist/index.js',
  healthPort: 7757,
  readOnly: false,
  services: { notion: false, googleCalendar: false, gmail: false, googleDrive: false },
}

function load(): McpSettings {
  if (typeof window === 'undefined') return defaultMcpSettings
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultMcpSettings
    const parsed = JSON.parse(raw) as Partial<McpSettings>
    return {
      ...defaultMcpSettings,
      ...parsed,
      services: { ...defaultMcpSettings.services, ...(parsed.services ?? {}) },
    }
  } catch {
    return defaultMcpSettings
  }
}

/** Configurações de MCP, persistidas em localStorage. */
export function useMcpSettings() {
  const [settings, setSettings] = useState<McpSettings>(load)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // localStorage indisponível (modo privado, quota) — segue em memória.
    }
  }, [settings])

  const update = useCallback(<K extends keyof McpSettings>(key: K, value: McpSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])

  const toggleService = useCallback((key: keyof McpServices) => {
    setSettings((s) => ({ ...s, services: { ...s.services, [key]: !s.services[key] } }))
  }, [])

  const reset = useCallback(() => setSettings(defaultMcpSettings), [])

  return { settings, update, toggleService, reset }
}

/** Monta o JSON de configuração para colar no cliente MCP. */
export function buildMcpConfig(s: McpSettings): string {
  const servers: Record<string, unknown> = {
    soucrum: {
      command: 'node',
      args: [s.serverPath || '/caminho/para/soucrum-mcp/dist/index.js'],
      env: {
        SOUCRUM_SUPABASE_URL: s.supabaseUrl || 'https://SEU-PROJETO.supabase.co',
        SOUCRUM_SUPABASE_KEY: s.publishableKey || 'sb_publishable_SUA_CHAVE',
        ...(s.readOnly ? { SOUCRUM_READ_ONLY: 'true' } : {}),
        ...(s.healthPort > 0 ? { SOUCRUM_HTTP_PORT: String(s.healthPort) } : {}),
      },
    },
  }
  if (s.services.notion) {
    servers.notion = {
      command: 'npx',
      args: ['-y', '@notionhq/notion-mcp-server'],
      env: { NOTION_TOKEN: 'ntn_SEU_TOKEN' },
    }
  }
  if (s.services.googleCalendar || s.services.gmail || s.services.googleDrive) {
    servers['google-workspace'] = {
      command: 'npx',
      args: ['-y', '@google/workspace-mcp'],
      env: {
        GOOGLE_OAUTH_CLIENT_ID: 'SEU_CLIENT_ID.apps.googleusercontent.com',
        GOOGLE_OAUTH_CLIENT_SECRET: 'SEU_CLIENT_SECRET',
      },
    }
  }
  return JSON.stringify({ mcpServers: servers }, null, 2)
}
