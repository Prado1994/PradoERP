"""Testes dos calculos de cronoanalise."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cronoanalise import stats
from cronoanalise.models import Ciclo, Leitura, Parametros


def ciclo(n, inicio, duracao, leituras=()):
    c = Ciclo(numero=n, inicio=inicio, fim=inicio + duracao)
    for nome, d in leituras:
        c.leituras.append(Leitura(nome, inicio, inicio + d))
        inicio += d
    return c


def test_tempo_padrao_aplica_ritmo_e_tolerancia():
    p = Parametros(fator_ritmo=1.10, fator_tolerancia=0.15, jornada_min=528, pecas_por_ciclo=1)
    r = stats.tempo_padrao(60.0, p)
    assert r["tempo_normal_s"] == 66.0             # 60 x 1,10
    assert abs(r["tempo_padrao_s"] - 75.9) < 0.01  # 66 x 1,15
    assert abs(r["capacidade_hora"] - 3600 / 75.9) < 0.1
    assert abs(r["capacidade_dia"] - (528 * 60) / 75.9) < 0.5


def test_takt_time_com_meta_do_grupo_prado():
    p = Parametros(jornada_min=528, demanda_dia=550)
    # 528 min = 31.680 s / 550 pares = 57,6 s por par
    assert abs(stats.takt_time(p) - 57.6) < 0.01


def test_outlier_de_parada_de_maquina_nao_entra_na_media():
    valores = [50.0, 51.0, 49.5, 50.5, 50.2, 49.8, 600.0]  # a ultima foi uma parada
    validos = stats.marcar_outliers(valores)
    assert validos[:-1] == [True] * 6
    assert validos[-1] is False


def test_tamanho_de_amostra_cresce_com_a_variacao():
    estavel = [50.0, 50.5, 49.5, 50.2, 49.8, 50.1]
    instavel = [30.0, 70.0, 45.0, 65.0, 35.0, 60.0]
    n_estavel = stats.tamanho_amostra(estavel, 0.95, 0.05)
    n_instavel = stats.tamanho_amostra(instavel, 0.95, 0.05)
    assert n_estavel < n_instavel
    assert n_instavel > 20


def test_analise_identifica_gargalo_e_projeta_producao():
    p = Parametros(fator_ritmo=1.0, fator_tolerancia=0.0, jornada_min=600,
                   meta_dia=550, demanda_dia=550, pecas_por_ciclo=1, postos=3)
    elementos = [("cortar", 10.0), ("pespontar", 30.0), ("montar", 20.0)]
    ciclos = [ciclo(i + 1, i * 60.0, 60.0, elementos) for i in range(10)]

    a = stats.analisar(ciclos, p, duracao_captura_s=600.0)

    assert a["ciclos"]["n"] == 10
    assert abs(a["tempos"]["tempo_padrao_s"] - 60.0) < 0.01
    assert a["gargalo"] == "pespontar"
    # 10 pecas em 600 s = 60 pecas/h; jornada de 600 min = 10 h -> 600 pecas
    assert abs(a["producao"]["ritmo_hora"] - 60.0) < 0.1
    assert abs(a["producao"]["projecao_dia"] - 600.0) < 1.0
    assert a["producao"]["aderencia_meta"] > 1.0     # bate a meta de 550
    # balanceamento: 60 s de trabalho / (3 postos x 30 s do gargalo) = 66,7%
    assert abs(a["eficiencia_linha"] - 0.6667) < 0.01


def test_analise_sem_ciclos_nao_quebra():
    a = stats.analisar([], Parametros(), 0.0)
    assert a["ciclos"]["n"] == 0
    assert a["tempos"]["tempo_padrao_s"] == 0.0
    assert a["gargalo"] is None


def test_outlier_em_processo_muito_estavel_usa_limite_relativo():
    # Elemento medido 6 vezes em 6,0 s e duas leituras picotadas no aquecimento
    # da camera. Sem criterio relativo, o sigma inflado deixaria as duas passarem.
    valores = [2.7, 2.2, 5.95, 6.0, 6.0, 6.0, 6.0, 6.0]
    validos = stats.marcar_outliers(valores)
    assert validos[0] is False and validos[1] is False
    assert all(validos[2:])
