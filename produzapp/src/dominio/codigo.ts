import { ehSigla, type Sigla } from './etapas.js';

export type CodigoLido =
  | { tipo: 'caixa'; op: string; caixa: string; sigla: Sigla }
  | { tipo: 'op'; op: string; sigla: Sigla }
  | { tipo: 'parada'; sigla: Sigla; motivo: string }
  | { tipo: 'retoma'; sigla: Sigla }
  | { tipo: 'sigla_desconhecida'; sigla: string }
  | { tipo: 'invalido' };

export interface CodigoNormalizado {
  codigo: string;
  /** Leitor sem Enter configurado: o mesmo código chegou colado 2x ou 3x. */
  colado: boolean;
}

/** Maiúsculas, sem espaços e desfaz leitura colada (mesmo trecho repetido 2x ou 3x). */
export function normalizar(bruto: string): CodigoNormalizado {
  const v = bruto.trim().toUpperCase();
  for (const rep of [3, 2]) {
    if (v.length > 0 && v.length % rep === 0) {
      const parte = v.slice(0, v.length / rep);
      if (parte.repeat(rep) === v) return { codigo: parte, colado: true };
    }
  }
  return { codigo: v, colado: false };
}

export const pad = (valor: string, n: number) => valor.padStart(n, '0');

/** Formatos: OP-CAIXA-SIGLA · OP-SIGLA · PARADA-SIGLA-MOTIVO · RETOMA-SIGLA */
export function interpretar(codigo: string): CodigoLido {
  let m = codigo.match(/^PARADA-([A-Z]{2,5})-(.+)$/);
  if (m) {
    const sigla = m[1]!;
    return ehSigla(sigla)
      ? { tipo: 'parada', sigla, motivo: m[2]!.replaceAll('-', ' ') }
      : { tipo: 'sigla_desconhecida', sigla };
  }
  m = codigo.match(/^RETOMA-([A-Z]{2,5})$/);
  if (m) {
    const sigla = m[1]!;
    return ehSigla(sigla) ? { tipo: 'retoma', sigla } : { tipo: 'sigla_desconhecida', sigla };
  }
  m = codigo.match(/^(\d{3,6})-(\d{1,3})-([A-Z]{2,5})$/);
  if (m) {
    const sigla = m[3]!;
    return ehSigla(sigla)
      ? { tipo: 'caixa', op: pad(m[1]!, 5), caixa: pad(m[2]!, 2), sigla }
      : { tipo: 'sigla_desconhecida', sigla };
  }
  m = codigo.match(/^(\d{3,6})-([A-Z]{2,5})$/);
  if (m) {
    const sigla = m[2]!;
    return ehSigla(sigla) ? { tipo: 'op', op: pad(m[1]!, 5), sigla } : { tipo: 'sigla_desconhecida', sigla };
  }
  return { tipo: 'invalido' };
}
