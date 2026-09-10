"""Motor de ciclos: transforma sinal de atividade das ROIs em ciclos e leituras.

O detector de visao entrega, a cada frame, um numero de 0 a 1 por ROI
("quanta atividade tem aqui agora"). Este modulo transforma esse sinal ruidoso
em tempos confiaveis, com dois filtros que todo cronoanalista faz na mao:

1. Histerese  - liga em limiar_on, so desliga em limiar_off (evita tremer no limite).
2. Debounce   - so aceita mudanca que se sustenta por min_on_s / min_off_s
                (ignora sombra, reflexo, alguem passando na frente).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .models import Ciclo, Leitura, ModoGatilho, ROI


@dataclass
class Gatilho:
    """Maquina de estados de uma ROI."""

    roi: ROI
    ativo: bool = False
    inicio_ativo: float = 0.0
    _cand_on: float | None = None
    _cand_off: float | None = None
    ultimo_valor: float = 0.0
    ativacoes: int = 0

    def atualizar(self, valor: float, ts: float) -> list[tuple[str, float, float]]:
        """Alimenta o gatilho com a atividade do frame.

        Retorna eventos: ("inicio", ts, 0.0) e ("fim", inicio, fim).
        """
        self.ultimo_valor = valor
        eventos: list[tuple[str, float, float]] = []

        if not self.ativo:
            if valor >= self.roi.limiar_on:
                if self._cand_on is None:
                    self._cand_on = ts
                elif ts - self._cand_on >= self.roi.min_on_s:
                    self.ativo = True
                    self.inicio_ativo = self._cand_on
                    self.ativacoes += 1
                    self._cand_on = None
                    self._cand_off = None
                    eventos.append(("inicio", self.inicio_ativo, 0.0))
            else:
                self._cand_on = None
        else:
            if valor <= self.roi.limiar_off:
                if self._cand_off is None:
                    self._cand_off = ts
                elif ts - self._cand_off >= self.roi.min_off_s:
                    fim = self._cand_off
                    self.ativo = False
                    self._cand_off = None
                    self._cand_on = None
                    eventos.append(("fim", self.inicio_ativo, fim))
            else:
                self._cand_off = None
        return eventos

    def encerrar(self, ts: float) -> list[tuple[str, float, float]]:
        """Fecha um elemento em aberto quando a captura termina."""
        if self.ativo:
            self.ativo = False
            return [("fim", self.inicio_ativo, ts)]
        return []


class MotorCiclos:
    """Junta os gatilhos em ciclos completos.

    Duas estrategias, escolhidas pelo modo das ROIs:

    - CONTADOR: uma ROI na saida do posto (esteira, caixa, rampa). Cada ativacao
      = 1 peca pronta; o ciclo e o intervalo entre duas ativacoes. E o modo mais
      robusto para camera de CFTV parada no teto.

    - ANCORA/ELEMENTO: varias ROIs, uma por etapa do trabalho. O ciclo comeca
      toda vez que a ROI ancora (a primeira etapa) reinicia. Da o detalhamento
      elemento a elemento, que e o que serve para atacar desperdicio.
    """

    def __init__(self, rois: list[ROI], on_evento: Callable[[dict[str, Any]], None] | None = None):
        self.gatilhos: dict[str, Gatilho] = {r.nome: Gatilho(r) for r in rois}
        self.on_evento = on_evento
        self.ciclos: list[Ciclo] = []
        self.t0: float | None = None
        self.ultimo_ts: float = 0.0
        self._ciclo_atual: Ciclo | None = None
        self._pendentes: list[Leitura] = []
        self._n_ciclo = 0

        ancoras = [r.nome for r in rois if r.modo is ModoGatilho.ANCORA]
        contadores = [r.nome for r in rois if r.modo is ModoGatilho.CONTADOR]
        elementos = [r for r in rois if r.modo is ModoGatilho.ELEMENTO]
        self.contadores = set(contadores)
        if ancoras:
            self.ancora = ancoras[0]
        elif contadores:
            self.ancora = None  # o proprio contador fecha o ciclo
        elif elementos:
            # sem ancora explicita, a primeira etapa da ordem vira ancora
            self.ancora = sorted(elementos, key=lambda r: (r.ordem, r.nome))[0].nome
        else:
            self.ancora = None

    # ------------------------------------------------------------------ #
    @property
    def duracao_captura(self) -> float:
        return max(0.0, self.ultimo_ts - (self.t0 or 0.0))

    def _emitir(self, tipo: str, **dados: Any) -> None:
        if self.on_evento:
            self.on_evento({"tipo": tipo, **dados})

    def processar(self, valores: dict[str, float], ts: float) -> None:
        """Processa um frame. `ts` em segundos desde o inicio da captura."""
        if self.t0 is None:
            self.t0 = ts
        self.ultimo_ts = ts

        for nome, valor in valores.items():
            g = self.gatilhos.get(nome)
            if g is None:
                continue
            for tipo, a, b in g.atualizar(valor, ts):
                if tipo == "inicio":
                    self._on_inicio(nome, a)
                else:
                    self._on_fim(nome, a, b)

    def _on_inicio(self, nome: str, ts: float) -> None:
        if nome in self.contadores:
            self._fechar_e_abrir(ts, motivo=f"peca detectada em {nome}")
            self._emitir("peca", elemento=nome, ts=round(ts, 3))
            return
        if nome == self.ancora:
            self._fechar_e_abrir(ts, motivo=f"reinicio do elemento ancora {nome}")
        self._emitir("elemento_inicio", elemento=nome, ts=round(ts, 3))

    def _on_fim(self, nome: str, inicio: float, fim: float) -> None:
        if nome in self.contadores:
            return  # contador nao vira leitura de elemento
        leitura = Leitura(elemento=nome, inicio=inicio, fim=fim, origem="visao")
        self._registrar_leitura(leitura)
        self._emitir("elemento_fim", elemento=nome, inicio=round(inicio, 3),
                     fim=round(fim, 3), duracao=round(leitura.duracao, 3))

    def _registrar_leitura(self, leitura: Leitura) -> None:
        c = self._ciclo_atual
        # A leitura pertence ao ciclo em que ela COMECOU.
        if c is not None and leitura.inicio >= c.inicio - 1e-6:
            leitura.ciclo = c.numero
            c.leituras.append(leitura)
        elif self.ciclos and leitura.inicio >= self.ciclos[-1].inicio:
            leitura.ciclo = self.ciclos[-1].numero
            self.ciclos[-1].leituras.append(leitura)
        else:
            self._pendentes.append(leitura)

    def _fechar_e_abrir(self, ts: float, motivo: str = "",
                        usar_pendentes: bool = False) -> None:
        c = self._ciclo_atual
        if c is None and usar_pendentes and self._pendentes:
            # Cronometro manual: o analista ja marcou elementos e so agora tocou
            # "fim de ciclo". Essas leituras sao DESTE ciclo que acaba de fechar,
            # nao do proximo - o ciclo e reconstruido a partir da primeira delas.
            self._n_ciclo += 1
            c = Ciclo(numero=self._n_ciclo, inicio=min(l.inicio for l in self._pendentes), fim=ts)
            for l in self._pendentes:
                l.ciclo = c.numero
                c.leituras.append(l)
            self._pendentes.clear()
        if c is not None:
            c.fim = ts
            if c.duracao > 0:
                self.ciclos.append(c)
                self._emitir("ciclo", numero=c.numero, duracao=round(c.duracao, 3),
                             inicio=round(c.inicio, 3), motivo=motivo,
                             leituras=len(c.leituras))
        self._n_ciclo += 1
        novo = Ciclo(numero=self._n_ciclo, inicio=ts, fim=ts)
        for l in self._pendentes:
            l.ciclo = novo.numero
            novo.leituras.append(l)
        self._pendentes.clear()
        self._ciclo_atual = novo

    # ------------------------------------------------------------------ #
    def marcar_manual(self, elemento: str, ts: float, fechar_ciclo: bool = False) -> None:
        """Cronometro manual: cada toque encerra o elemento anterior.

        Usado tanto sozinho (cronoanalise classica com o celular na mao) quanto
        junto da visao, para o analista corrigir/validar o que a camera viu.
        """
        if self.t0 is None:
            self.t0 = ts
        self.ultimo_ts = max(self.ultimo_ts, ts)
        anterior = getattr(self, "_manual_aberto", None)
        if anterior is not None:
            nome, inicio = anterior
            if ts > inicio:
                self._registrar_leitura(Leitura(nome, inicio, ts, origem="manual"))
                self._emitir("elemento_fim", elemento=nome, inicio=round(inicio, 3),
                             fim=round(ts, 3), duracao=round(ts - inicio, 3), origem="manual")
        if fechar_ciclo:
            self._fechar_e_abrir(ts, motivo="marcacao manual de fim de ciclo",
                                 usar_pendentes=True)
        if elemento:
            self._manual_aberto = (elemento, ts)
            self._emitir("elemento_inicio", elemento=elemento, ts=round(ts, 3), origem="manual")
        else:
            self._manual_aberto = None

    def finalizar(self) -> list[Ciclo]:
        """Encerra elementos e ciclo em aberto e devolve os ciclos completos."""
        ts = self.ultimo_ts
        for nome, g in self.gatilhos.items():
            for _, a, b in g.encerrar(ts):
                if nome not in self.contadores:
                    self._registrar_leitura(Leitura(nome, a, b, origem="visao"))
        manual = getattr(self, "_manual_aberto", None)
        if manual is not None and ts > manual[1]:
            self._registrar_leitura(Leitura(manual[0], manual[1], ts, origem="manual"))
            self._manual_aberto = None
        # O ciclo em aberto e descartado: ciclo incompleto nao entra na media.
        self._ciclo_atual = None
        return self.ciclos

    def estado(self) -> dict[str, Any]:
        return {
            "duracao_s": round(self.duracao_captura, 2),
            "ciclos_completos": len(self.ciclos),
            "ciclo_em_andamento": self._ciclo_atual.numero if self._ciclo_atual else None,
            "gatilhos": {
                n: {"ativo": g.ativo, "valor": round(g.ultimo_valor, 4),
                    "ativacoes": g.ativacoes, "modo": g.roi.modo.value}
                for n, g in self.gatilhos.items()
            },
        }
