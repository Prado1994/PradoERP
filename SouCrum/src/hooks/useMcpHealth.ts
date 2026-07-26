import { useCallback, useState } from 'react'

export interface McpToolInfo {
  name: string
  description: string
  write: boolean
}

export interface McpHealth {
  ok: boolean
  name: string
  version: string
  mode: 'read-only' | 'read-write'
  auth: string
  supabase: { url: string; reachable: boolean; latency_ms: number; error?: string }
  tool_count: number
  write_tool_count: number
  tools: McpToolInfo[]
  checked_at: string
}

export type HealthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: McpHealth }
  | { status: 'error'; message: string; hint?: string }

/**
 * Consulta o endpoint /health do servidor MCP local.
 *
 * O servidor escuta em 127.0.0.1, então navegadores permitem a chamada mesmo
 * de uma página HTTPS (localhost é tratado como origem segura). O Safari é mais
 * restritivo — daí a dica no erro.
 */
export function useMcpHealth(port: number) {
  const [state, setState] = useState<HealthState>({ status: 'idle' })

  const check = useCallback(async () => {
    if (!port || port <= 0) {
      setState({ status: 'error', message: 'Defina a porta do endpoint de status.' })
      return
    }
    setState({ status: 'loading' })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal })
      if (!res.ok) {
        setState({ status: 'error', message: `O servidor respondeu ${res.status}.` })
        return
      }
      setState({ status: 'ok', data: (await res.json()) as McpHealth })
    } catch (e) {
      const abortado = e instanceof DOMException && e.name === 'AbortError'
      setState({
        status: 'error',
        message: abortado
          ? 'Tempo esgotado ao falar com o servidor.'
          : 'Não foi possível alcançar o servidor MCP.',
        hint: abortado
          ? undefined
          : `Confira se ele está rodando com SOUCRUM_HTTP_PORT=${port}. No Safari, chamadas para localhost podem ser bloqueadas — teste no Chrome.`,
      })
    } finally {
      clearTimeout(timer)
    }
  }, [port])

  return { state, check }
}
