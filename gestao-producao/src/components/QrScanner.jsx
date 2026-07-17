import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

// Leitor de QR via câmera do navegador. Chama onScan(texto) na primeira leitura.
export default function QrScanner({ onScan }) {
  const ref = useRef(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    const id = 'qr-reader-' + Math.random().toString(36).slice(2)
    ref.current.id = id
    const scanner = new Html5Qrcode(id)
    let ativo = true

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (texto) => {
          if (!ativo) return
          ativo = false
          scanner.stop().catch(() => {})
          onScanRef.current(texto)
        },
        () => {}
      )
      .catch(() => {})

    return () => {
      ativo = false
      scanner.stop().catch(() => {})
    }
  }, [])

  return <div ref={ref} className="overflow-hidden rounded-card bg-black" />
}
