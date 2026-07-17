import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import QrScanner from '../components/QrScanner'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export default function Apontamento() {
  const { profile } = useAuth()
  const [modo, setModo] = useState('scan') // scan | manual | form | ok
  const [ficha, setFicha] = useState(null)
  const [numeroManual, setNumeroManual] = useState('')
  const [colaboradores, setColaboradores] = useState([])
  const [motivos, setMotivos] = useState([])
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const [colaboradorId, setColaboradorId] = useState('')
  const [qtdProduzida, setQtdProduzida] = useState('')
  const [qtdPerdida, setQtdPerdida] = useState('0')
  const [motivoPerda, setMotivoPerda] = useState('')

  useEffect(() => {
    supabase
      .from('colaboradores')
      .select('id, nome, setor, unidade_id')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setColaboradores(data ?? []))
    supabase
      .from('motivos_perda')
      .select('id, descricao')
      .eq('ativo', true)
      .order('id')
      .then(({ data }) => setMotivos(data ?? []))
  }, [])

  async function carregarFicha({ qrToken, numero }) {
    setErro(null)
    let query = supabase.from('vw_fichas_painel').select('*')
    query = qrToken ? query.eq('qr_token', qrToken) : query.eq('numero', numero.trim().toUpperCase())
    const { data, error } = await query.maybeSingle()
    if (error || !data) {
      setErro('Ficha não encontrada. Confira o QR Code ou o número.')
      setModo('manual')
      return
    }
    if (data.status !== 'em_andamento') {
      setErro(`A ficha ${data.numero} já está ${data.status === 'concluida' ? 'concluída' : 'cancelada'}.`)
      setModo('manual')
      return
    }
    setFicha(data)
    setQtdProduzida('')
    setQtdPerdida('0')
    setMotivoPerda('')
    setModo('form')
  }

  function aoEscanear(texto) {
    const m = texto.match(UUID_RE)
    if (m) carregarFicha({ qrToken: m[0] })
    else {
      setErro('QR Code não reconhecido.')
      setModo('manual')
    }
  }

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    setSalvando(true)
    const { data, error } = await supabase.rpc('registrar_apontamento', {
      p_qr_token: ficha.qr_token,
      p_etapa_id: ficha.etapa_atual_id,
      p_qtd_produzida: Number(qtdProduzida),
      p_qtd_perdida: Number(qtdPerdida) || 0,
      p_motivo_perda: motivoPerda || null,
      p_colaborador_id: colaboradorId || null,
    })
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setResultado(data)
    setModo('ok')
  }

  if (modo === 'ok') {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-6 text-center">
          <div className="mb-2 text-4xl">✓</div>
          <h1 className="mb-1 text-lg font-semibold">Apontamento registrado</h1>
          <p className="mb-4 text-sm text-[--text-muted]">
            Ficha {resultado?.ficha}
            {resultado?.ficha_concluida
              ? ' — produção concluída! 🎉'
              : resultado?.etapa_avancou
                ? ' — etapa concluída, ficha avançou para a próxima etapa.'
                : ' — apontamento parcial salvo.'}
          </p>
          <button
            className="btn-primary w-full"
            onClick={() => {
              setFicha(null)
              setResultado(null)
              setModo('scan')
            }}
          >
            Apontar outra ficha
          </button>
        </div>
      </div>
    )
  }

  if (modo === 'form' && ficha) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card mb-4 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-lg font-semibold">{ficha.numero}</span>
            <span className="badge badge-tatico">{ficha.unidade}</span>
          </div>
          <p className="text-sm text-[--text-muted]">
            {ficha.modelo_codigo} · {ficha.modelo_nome} · {ficha.marca}
          </p>
          <p className="text-sm text-[--text-muted]">
            OP {ficha.op_numero} · {ficha.quantidade} pares
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="badge badge-operacional">{ficha.etapa_atual}</span>
            <span className="text-xs text-[--text-faint]">etapa atual</span>
          </div>
        </div>

        <form onSubmit={salvar} className="card p-4">
          <label className="mb-1 block text-sm font-medium">Colaborador</label>
          <select
            className="input mb-3"
            value={colaboradorId}
            onChange={(e) => setColaboradorId(e.target.value)}
          >
            <option value="">— selecionar —</option>
            {colaboradores
              .filter((c) => !profile?.unidade_id || c.unidade_id === profile.unidade_id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.setor ? `(${c.setor})` : ''}
                </option>
              ))}
          </select>

          <label className="mb-1 block text-sm font-medium">Quantidade produzida (pares)</label>
          <input
            className="input mb-3"
            type="number"
            inputMode="numeric"
            min="0"
            value={qtdProduzida}
            onChange={(e) => setQtdProduzida(e.target.value)}
            required
            autoFocus
          />

          <label className="mb-1 block text-sm font-medium">Perdas / refugo</label>
          <input
            className="input mb-3"
            type="number"
            inputMode="numeric"
            min="0"
            value={qtdPerdida}
            onChange={(e) => setQtdPerdida(e.target.value)}
          />

          {Number(qtdPerdida) > 0 && (
            <>
              <label className="mb-1 block text-sm font-medium">Motivo da perda</label>
              <select
                className="input mb-3"
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
                required
              >
                <option value="">— selecionar —</option>
                {motivos.map((m) => (
                  <option key={m.id} value={m.descricao}>
                    {m.descricao}
                  </option>
                ))}
              </select>
            </>
          )}

          {erro && <p className="mb-3 text-sm font-medium text-terra">{erro}</p>}

          <button className="btn-primary w-full" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Confirmar apontamento'}
          </button>
          <button
            type="button"
            className="mt-2 w-full rounded-[7px] px-4 py-2 text-sm text-[--text-muted] hover:bg-black/5"
            onClick={() => {
              setFicha(null)
              setModo('scan')
            }}
          >
            Cancelar
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-lg font-semibold">Apontar produção</h1>

      {modo === 'scan' && (
        <>
          <QrScanner onScan={aoEscanear} />
          <button className="btn-secondary mt-4 w-full" onClick={() => setModo('manual')}>
            Digitar número da ficha
          </button>
        </>
      )}

      {modo === 'manual' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            carregarFicha({ numero: numeroManual })
          }}
          className="card p-4"
        >
          <label className="mb-1 block text-sm font-medium">Número da ficha</label>
          <input
            className="input mb-3"
            placeholder="F-000001"
            value={numeroManual}
            onChange={(e) => setNumeroManual(e.target.value)}
            autoFocus
            required
          />
          {erro && <p className="mb-3 text-sm font-medium text-terra">{erro}</p>}
          <button className="btn-primary w-full">Buscar ficha</button>
          <button
            type="button"
            className="mt-2 w-full rounded-[7px] px-4 py-2 text-sm text-[--text-muted] hover:bg-black/5"
            onClick={() => {
              setErro(null)
              setModo('scan')
            }}
          >
            Voltar ao leitor de QR Code
          </button>
        </form>
      )}
    </div>
  )
}
