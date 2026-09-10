"""Calculos de cronoanalise: tempo normal, tempo padrao, capacidade e produtividade.

Sem dependencia de numpy - roda em qualquer lugar, inclusive num Raspberry Pi
ligado a uma camera de CFTV.
"""

from __future__ import annotations

import math
from statistics import median
from typing import Any, Iterable, Sequence

from .models import Ciclo, Parametros

# z bilateral para os niveis de confianca usuais em estudo de tempos
_Z = {0.90: 1.645, 0.95: 1.960, 0.99: 2.576}


def z_para(confianca: float) -> float:
    if confianca in _Z:
        return _Z[confianca]
    return min(_Z.items(), key=lambda kv: abs(kv[0] - confianca))[1]


def _media(v: Sequence[float]) -> float:
    return sum(v) / len(v) if v else 0.0


def _desvio(v: Sequence[float]) -> float:
    """Desvio padrao amostral (n-1), como manda o estudo de tempos."""
    if len(v) < 2:
        return 0.0
    m = _media(v)
    return math.sqrt(sum((x - m) ** 2 for x in v) / (len(v) - 1))


def marcar_outliers(valores: Sequence[float], k: float = 3.0) -> list[bool]:
    """Marca leituras anomalas pelo MAD (mediana dos desvios absolutos).

    Mais robusto que media +/- 3 sigma: uma unica parada longa de maquina nao
    contamina o criterio. Retorna a lista de "e valido".
    """
    if len(valores) < 4:
        return [True] * len(valores)
    med = median(valores)
    desvios = [abs(x - med) for x in valores]
    mad = median(desvios)
    if mad <= 1e-9:
        # Processo praticamente constante (mais da metade das leituras iguais).
        # Aqui o desvio padrao nao serve de criterio: uma unica leitura muito
        # diferente ja infla o sigma e passaria como valida. Usa-se entao um
        # limite relativo a mediana - a pratica de chao de fabrica de descartar
        # leitura fora de +/-25% quando o processo esta estavel.
        if med <= 1e-9:
            return [True] * len(valores)
        return [abs(x - med) <= 0.25 * med for x in valores]
    sigma = 1.4826 * mad  # MAD -> desvio padrao equivalente na normal
    return [abs(x - med) <= k * sigma for x in valores]


def tamanho_amostra(valores: Sequence[float], confianca: float, erro_relativo: float) -> int:
    """Numero de ciclos necessarios: n = (z*s / (e*media))^2.

    Formula classica de dimensionamento de amostra em cronoanalise.
    """
    if len(valores) < 2:
        return 0
    m = _media(valores)
    s = _desvio(valores)
    if m <= 0 or erro_relativo <= 0:
        return 0
    n = (z_para(confianca) * s / (erro_relativo * m)) ** 2
    return int(math.ceil(n))


def resumo_serie(valores: Sequence[float]) -> dict[str, Any]:
    if not valores:
        return {"n": 0, "media": 0.0, "mediana": 0.0, "desvio": 0.0, "cv": 0.0,
                "min": 0.0, "max": 0.0}
    m = _media(valores)
    s = _desvio(valores)
    return {
        "n": len(valores),
        "media": round(m, 3),
        "mediana": round(median(valores), 3),
        "desvio": round(s, 3),
        "cv": round(s / m, 4) if m else 0.0,   # coeficiente de variacao
        "min": round(min(valores), 3),
        "max": round(max(valores), 3),
    }


def tempo_padrao(tm: float, p: Parametros) -> dict[str, float]:
    """TM -> TN -> TP e as capacidades derivadas."""
    tn = tm * p.fator_ritmo
    tp = tn * (1.0 + p.fator_tolerancia)
    pecas_ciclo = max(p.pecas_por_ciclo, 1e-9)
    tp_peca = tp / pecas_ciclo
    cap_hora = 3600.0 / tp_peca if tp_peca > 0 else 0.0
    cap_dia = (p.jornada_min * 60.0) / tp_peca if tp_peca > 0 else 0.0
    return {
        "tempo_medio_s": round(tm, 3),
        "tempo_normal_s": round(tn, 3),
        "tempo_padrao_s": round(tp, 3),
        "tempo_padrao_peca_s": round(tp_peca, 3),
        "capacidade_hora": round(cap_hora, 1),
        "capacidade_dia": round(cap_dia, 1),
    }


def takt_time(p: Parametros) -> float:
    """Takt = tempo disponivel / demanda. Em segundos por peca."""
    if p.demanda_dia <= 0:
        return 0.0
    return (p.jornada_min * 60.0) / p.demanda_dia


def analisar(ciclos: Sequence[Ciclo], p: Parametros,
             duracao_captura_s: float = 0.0) -> dict[str, Any]:
    """Consolida o estudo inteiro: ciclos, elementos, capacidade e gargalo."""
    duracoes = [c.duracao for c in ciclos if c.duracao > 0]
    validos = marcar_outliers(duracoes)
    for c, ok in zip([c for c in ciclos if c.duracao > 0], validos):
        c.valido = ok
    limpos = [d for d, ok in zip(duracoes, validos) if ok]
    base = limpos or duracoes

    tm = _media(base)
    padrao = tempo_padrao(tm, p) if tm > 0 else tempo_padrao(0.0, p)
    takt = takt_time(p)

    # --- elementos -------------------------------------------------------
    por_elemento: dict[str, list[float]] = {}
    for c in ciclos:
        for l in c.leituras:
            por_elemento.setdefault(l.elemento, []).append(l.duracao)

    elementos = []
    for nome, vals in por_elemento.items():
        ok = marcar_outliers(vals)
        val_limpos = [v for v, o in zip(vals, ok) if o] or vals
        r = resumo_serie(val_limpos)
        tme = r["media"]
        el = {
            "elemento": nome,
            **r,
            "descartadas": len(vals) - len(val_limpos),
            **tempo_padrao(tme, p),
            "n_recomendado": tamanho_amostra(val_limpos, p.confianca, p.erro_relativo),
        }
        el["participacao"] = round(tme / tm, 4) if tm > 0 else 0.0
        elementos.append(el)
    elementos.sort(key=lambda e: -e["tempo_padrao_s"])

    # --- gargalo e balanceamento ----------------------------------------
    gargalo = elementos[0] if elementos else None
    soma_tp = sum(e["tempo_padrao_s"] for e in elementos)
    if gargalo and p.postos > 0 and gargalo["tempo_padrao_s"] > 0:
        eficiencia_linha = soma_tp / (p.postos * gargalo["tempo_padrao_s"])
    else:
        eficiencia_linha = 0.0

    # --- produtividade observada ----------------------------------------
    n_ok = len([c for c in ciclos if c.valido])
    pecas = n_ok * p.pecas_por_ciclo
    ritmo_hora = (pecas / duracao_captura_s * 3600.0) if duracao_captura_s > 0 else 0.0
    projecao_dia = ritmo_hora * (p.jornada_min / 60.0)

    cap_dia = padrao["capacidade_dia"]
    return {
        "ciclos": {
            **resumo_serie(base),
            "total_medidos": len(duracoes),
            "descartados": len(duracoes) - len(limpos),
            "n_recomendado": tamanho_amostra(base, p.confianca, p.erro_relativo),
            "amostra_suficiente": len(base) >= tamanho_amostra(base, p.confianca, p.erro_relativo),
        },
        "tempos": padrao,
        "takt_time_s": round(takt, 3),
        "atende_takt": bool(takt > 0 and padrao["tempo_padrao_peca_s"] <= takt),
        "elementos": elementos,
        "gargalo": gargalo["elemento"] if gargalo else None,
        "eficiencia_linha": round(eficiencia_linha, 4),
        "producao": {
            "pecas_observadas": round(pecas, 2),
            "duracao_captura_s": round(duracao_captura_s, 1),
            "ritmo_hora": round(ritmo_hora, 1),
            "projecao_dia": round(projecao_dia, 1),
            "meta_dia": p.meta_dia,
            "aderencia_meta": round(projecao_dia / p.meta_dia, 4) if p.meta_dia else 0.0,
            "capacidade_dia_padrao": cap_dia,
            "produtividade": round(projecao_dia / cap_dia, 4) if cap_dia else 0.0,
            "gap_meta_dia": round(projecao_dia - p.meta_dia, 1),
        },
    }


def linhas_csv(ciclos: Iterable[Ciclo]) -> list[list[Any]]:
    """Tabela plana para exportacao (uma linha por leitura)."""
    linhas: list[list[Any]] = [
        ["ciclo", "ciclo_valido", "ciclo_inicio_s", "ciclo_duracao_s",
         "elemento", "elemento_inicio_s", "elemento_fim_s", "elemento_duracao_s",
         "origem", "leitura_valida"]
    ]
    for c in ciclos:
        if not c.leituras:
            linhas.append([c.numero, c.valido, round(c.inicio, 3), round(c.duracao, 3),
                           "", "", "", "", "", ""])
        for l in c.leituras:
            linhas.append([
                c.numero, c.valido, round(c.inicio, 3), round(c.duracao, 3),
                l.elemento, round(l.inicio, 3), round(l.fim, 3), round(l.duracao, 3),
                l.origem, l.valida,
            ])
    return linhas
