"""Linha de comando: analisa um video (ou uma camera) sem subir o servidor.

Util para rodar em lote na madrugada sobre as gravacoes da CFTV:

    python -m cronoanalise.cli video.mp4 --config posto.json --csv saida.csv

O arquivo de configuracao e o mesmo JSON do estudo (baixe pela API em
/api/estudos/<id>) ou um JSON simples so com "rois" e "parametros".
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from . import stats
from .lote import analisar_video
from .models import Estudo


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="cronoanalise",
        description="Cronoanalise por visao computacional - Grupo Prado")
    ap.add_argument("fonte", help="arquivo de video, rtsp://..., ou webcam:0")
    ap.add_argument("--config", required=True, help="JSON do estudo (com as ROIs)")
    ap.add_argument("--csv", help="arquivo CSV de saida (uma linha por leitura)")
    ap.add_argument("--json", dest="json_out", help="arquivo JSON com a analise completa")
    ap.add_argument("--detector", default="auto", choices=["auto", "roi", "yolo", "pose"])
    ap.add_argument("--silencioso", action="store_true", help="nao imprime o progresso")
    args = ap.parse_args(argv)

    dados = json.loads(Path(args.config).read_text(encoding="utf-8"))
    estudo = Estudo.from_dict(dados)

    def mostrar(ts: float, ciclos: int) -> None:
        if not args.silencioso:
            print(f"\r  {ts:7.1f}s  ciclos={ciclos}", end="", flush=True)

    try:
        ciclos, analise, _ = analisar_video(estudo, args.fonte, args.detector,
                                            progresso=mostrar)
    except KeyboardInterrupt:
        print("\n  interrompido pelo usuario", file=sys.stderr)
        return 130
    except ValueError as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 2

    if not args.silencioso:
        print()

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8-sig") as fh:
            csv.writer(fh, delimiter=";").writerows(stats.linhas_csv(ciclos))
        if not args.silencioso:
            print(f"  CSV gravado em {args.csv}")

    if args.json_out:
        Path(args.json_out).write_text(
            json.dumps({"estudo": estudo.to_dict(), "analise": analise,
                        "ciclos": [c.to_dict() for c in ciclos]},
                       ensure_ascii=False, indent=2), encoding="utf-8")
        if not args.silencioso:
            print(f"  JSON gravado em {args.json_out}")

    c, t, p = analise["ciclos"], analise["tempos"], analise["producao"]
    print(f"""
  {estudo.nome} - {estudo.unidade} / {estudo.setor}
  --------------------------------------------------------------
  Ciclos validos ....... {c['n']} (de {c['total_medidos']} medidos)
  Tempo medio (TM) ..... {t['tempo_medio_s']:.2f} s
  Tempo normal (TN) .... {t['tempo_normal_s']:.2f} s
  Tempo padrao (TP) .... {t['tempo_padrao_s']:.2f} s
  Takt time ............ {analise['takt_time_s']:.2f} s  ->  {'ATENDE' if analise['atende_takt'] else 'NAO ATENDE'}
  Capacidade/hora ...... {t['capacidade_hora']:.0f} pares
  Capacidade/dia ....... {t['capacidade_dia']:.0f} pares
  Projecao do dia ...... {p['projecao_dia']:.0f} pares (meta {p['meta_dia']:.0f})
  Gargalo .............. {analise['gargalo'] or '-'}
  Amostra .............. {c['n']}/{c['n_recomendado']} ciclos ({'suficiente' if c['amostra_suficiente'] else 'medir mais'})
""")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
