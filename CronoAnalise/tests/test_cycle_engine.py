"""Testes do motor de ciclos - sem camera, com sinal sintetico."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cronoanalise.cycle_engine import MotorCiclos
from cronoanalise.models import ModoDeteccao, ModoGatilho, ROI


def roi(nome, modo=ModoGatilho.ELEMENTO, **kw):
    return ROI(nome=nome, pontos=[(0, 0), (1, 0), (1, 1)], modo=modo,
               deteccao=ModoDeteccao.MOVIMENTO, min_on_s=0.2, min_off_s=0.2, **kw)


def alimentar(motor, plano, fps=20.0):
    """plano: lista de (duracao_s, {roi: valor}) processada quadro a quadro."""
    t = 0.0
    passo = 1.0 / fps
    for duracao, valores in plano:
        fim = t + duracao
        while t < fim:
            motor.processar(valores, t)
            t += passo
    return t


def test_contador_gera_um_ciclo_por_ativacao():
    m = MotorCiclos([roi("saida", ModoGatilho.CONTADOR)])
    # 4 pecas passando a cada 10 s (1 s de ocupacao + 9 s livre)
    plano = []
    for _ in range(4):
        plano += [(1.0, {"saida": 0.9}), (9.0, {"saida": 0.0})]
    alimentar(m, plano)
    m.finalizar()
    # 4 ativacoes -> 3 ciclos completos (o primeiro so marca o inicio)
    assert len(m.ciclos) == 3
    for c in m.ciclos:
        assert 9.5 < c.duracao < 10.5


def test_elementos_com_ancora_fecham_ciclo_e_registram_leituras():
    rois = [roi("cortar", ModoGatilho.ANCORA), roi("montar"), roi("colar")]
    m = MotorCiclos(rois)
    livre = {"cortar": 0.0, "montar": 0.0, "colar": 0.0}
    plano = []
    for _ in range(3):
        plano += [
            (2.0, {**livre, "cortar": 0.8}),
            (0.5, livre),
            (3.0, {**livre, "montar": 0.8}),
            (0.5, livre),
            (1.5, {**livre, "colar": 0.8}),
            (0.5, livre),
        ]
    alimentar(m, plano)
    m.finalizar()

    assert len(m.ciclos) == 2  # o terceiro ciclo fica aberto e e descartado
    for c in m.ciclos:
        nomes = sorted(l.elemento for l in c.leituras)
        assert nomes == ["colar", "cortar", "montar"]
        assert 7.5 < c.duracao < 8.5


def test_debounce_ignora_respingo_curto():
    m = MotorCiclos([roi("saida", ModoGatilho.CONTADOR)])
    plano = []
    for _ in range(5):
        plano += [(0.1, {"saida": 0.9}), (2.0, {"saida": 0.0})]  # picos de 0,1 s
    alimentar(m, plano)
    m.finalizar()
    assert len(m.ciclos) == 0
    assert m.gatilhos["saida"].ativacoes == 0


def test_histerese_evita_oscilacao_no_limiar():
    r = roi("trabalho")
    r.limiar_on, r.limiar_off = 0.20, 0.08
    m = MotorCiclos([r])
    # valor oscilando entre 0,10 e 0,18: nunca liga (abaixo de 0,20)...
    plano = [(1.0, {"trabalho": 0.10}), (1.0, {"trabalho": 0.18})] * 3
    alimentar(m, plano)
    assert not m.gatilhos["trabalho"].ativo
    # ...liga em 0,30 e nao desliga em 0,12 (acima do limiar_off)
    alimentar(m, [(1.0, {"trabalho": 0.30}), (2.0, {"trabalho": 0.12})])
    assert m.gatilhos["trabalho"].ativo


def test_cronometro_manual_registra_leituras_e_ciclos():
    m = MotorCiclos([roi("preparar"), roi("costurar")])
    for i in range(3):
        base = i * 30.0
        m.marcar_manual("preparar", base, fechar_ciclo=True)
        m.marcar_manual("costurar", base + 12.0)
    m.marcar_manual("", 90.0, fechar_ciclo=True)
    m.finalizar()

    assert len(m.ciclos) == 3
    for c in m.ciclos:
        assert abs(c.duracao - 30.0) < 0.01
        duracoes = {l.elemento: l.duracao for l in c.leituras}
        assert abs(duracoes["preparar"] - 12.0) < 0.01
        assert abs(duracoes["costurar"] - 18.0) < 0.01
        assert all(l.origem == "manual" for l in c.leituras)


def test_manual_sem_marcar_inicio_atribui_leituras_ao_ciclo_que_fecha():
    """O analista marca os elementos e so no fim toca "fim de ciclo".

    As leituras sao do ciclo que acabou de terminar, nao do proximo.
    """
    m = MotorCiclos([roi("preparar"), roi("costurar")])
    m.marcar_manual("preparar", 0.0)
    m.marcar_manual("costurar", 10.0)
    m.marcar_manual("", 25.0, fechar_ciclo=True)   # fim do 1o ciclo
    m.marcar_manual("preparar", 25.0)
    m.marcar_manual("costurar", 36.0)
    m.marcar_manual("", 50.0, fechar_ciclo=True)   # fim do 2o ciclo
    m.finalizar()

    assert len(m.ciclos) == 2
    assert abs(m.ciclos[0].duracao - 25.0) < 0.01
    assert abs(m.ciclos[1].duracao - 25.0) < 0.01
    assert sorted(l.elemento for l in m.ciclos[0].leituras) == ["costurar", "preparar"]
    assert abs(m.ciclos[0].leituras[0].duracao - 10.0) < 0.01   # preparar
    assert abs(m.ciclos[0].leituras[1].duracao - 15.0) < 0.01   # costurar
