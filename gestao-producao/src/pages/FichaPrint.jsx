import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'

const ETAPAS_ORDEM = ['Corte', 'Pesponto', 'Pré-montagem', 'Montagem', 'Acabamento', 'Expedição']

export default function FichaPrint() {
  const { id } = useParams()
  const [ficha, setFicha] = useState(null)

  useEffect(() => {
    supabase
      .from('fichas')
      .select('*, ordens_producao(numero, prazo, quantidade_total, modelos(codigo, nome, marca), unidades(nome))')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setFicha(data))
  }, [id])

  if (!ficha) return <p className="p-6 text-[--text-muted]">Carregando…</p>

  const op = ficha.ordens_producao
  const grade = Object.entries(ficha.grade ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]))

  return (
    <div className="mx-auto max-w-2xl bg-white p-6 print:p-2">
      <div className="no-print mb-4 flex gap-2">
        <button className="btn-primary" onClick={() => window.print()}>Imprimir</button>
        <Link to="/" className="btn-secondary inline-block">Voltar ao painel</Link>
      </div>

      <div className="border-2 border-navy">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 bg-navy p-4 text-warm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-terra text-lg font-semibold text-white">
            P
          </div>
          <div className="flex-1">
            <div className="text-[17px] font-semibold leading-tight">Grupo Prado</div>
            <div className="text-xs italic text-beige">Ficha de Produção</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-yellow">{ficha.numero}</div>
            <div className="text-xs text-beige">OP {op?.numero}</div>
          </div>
        </div>

        {/* Dados + QR */}
        <div className="flex flex-wrap items-start gap-6 p-5">
          <div className="flex-1 space-y-1.5 text-sm">
            <p><span className="font-semibold">Modelo:</span> {op?.modelos?.codigo} — {op?.modelos?.nome}</p>
            <p><span className="font-semibold">Marca:</span> {op?.modelos?.marca}</p>
            <p><span className="font-semibold">Unidade:</span> {op?.unidades?.nome}</p>
            <p><span className="font-semibold">Quantidade da ficha:</span> {ficha.quantidade} pares{ficha.lote ? ` (lote ${ficha.lote})` : ''}</p>
            {op?.prazo && (
              <p><span className="font-semibold">Prazo:</span> {new Date(op.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            )}
          </div>
          <div className="text-center">
            <QRCodeSVG value={ficha.qr_token} size={140} />
            <div className="mt-1 text-[10px] text-[--text-faint]">Escanear para apontar</div>
          </div>
        </div>

        {/* Grade de numeração */}
        {grade.length > 0 && (
          <div className="px-5 pb-4">
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr>
                  {grade.map(([n]) => (
                    <th key={n} className="border border-black/20 bg-[--bg] px-2 py-1">{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {grade.map(([n, q]) => (
                    <td key={n} className="border border-black/20 px-2 py-1">{q}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Quadro de apontamento manual (backup em papel) */}
        <div className="px-5 pb-5">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[--bg]">
                <th className="border border-black/20 px-2 py-1.5 text-left">Etapa</th>
                <th className="border border-black/20 px-2 py-1.5">Qtd. produzida</th>
                <th className="border border-black/20 px-2 py-1.5">Perdas</th>
                <th className="border border-black/20 px-2 py-1.5">Responsável</th>
                <th className="border border-black/20 px-2 py-1.5">Data</th>
              </tr>
            </thead>
            <tbody>
              {ETAPAS_ORDEM.map((e) => (
                <tr key={e}>
                  <td className="border border-black/20 px-2 py-3 font-medium">{e}</td>
                  <td className="border border-black/20" />
                  <td className="border border-black/20" />
                  <td className="border border-black/20" />
                  <td className="border border-black/20" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-black/10 py-2 text-center text-[10px] text-[--text-faint]">
          Grupo Prado · Safety Prado · Country Prado · Itanhandu &amp; Guaxupé
        </div>
      </div>
    </div>
  )
}
