"""Modelos de dados da cronoanalise.

Vocabulario alinhado ao metodo classico de estudo de tempos (Taylor/Gilbreth,
consolidado no Brasil por Barnes, "Estudo de Movimentos e de Tempos"):

- Elemento .... menor parte do trabalho que se mede separadamente.
- Ciclo ....... sequencia completa de elementos que produz uma peca/par.
- Leitura ..... um tempo cronometrado de um elemento em um ciclo.
- TM .......... tempo medio cronometrado.
- TN .......... tempo normal  = TM x FR (fator de ritmo).
- TP .......... tempo padrao  = TN x (1 + FT) (fator de tolerancia).
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any


def novo_id(prefixo: str) -> str:
    return f"{prefixo}_{uuid.uuid4().hex[:10]}"


class ModoGatilho(str, Enum):
    """Como a atividade de uma regiao de interesse (ROI) vira informacao."""

    ELEMENTO = "elemento"   # ROI ativa = elemento sendo executado (mede duracao)
    CONTADOR = "contador"   # cada ativacao = 1 peca concluida (mede intervalo)
    ANCORA = "ancora"       # elemento que marca o inicio de um novo ciclo


class ModoDeteccao(str, Enum):
    MOVIMENTO = "movimento"   # subtracao de fundo adaptativa (MOG2)
    PRESENCA = "presenca"     # diferenca contra um fundo de referencia
    OBJETO = "objeto"         # detector YOLO opcional (peca/caixa dentro da zona)
    POSE = "pose"             # quantificacao de movimento do operador (MediaPipe)


@dataclass
class ROI:
    """Regiao de interesse desenhada sobre a imagem da camera.

    Coordenadas normalizadas (0..1) para funcionar em qualquer resolucao:
    a mesma ROI vale para o celular em 720p e para a CFTV em 1080p.
    """

    nome: str
    pontos: list[tuple[float, float]]
    modo: ModoGatilho = ModoGatilho.ELEMENTO
    deteccao: ModoDeteccao = ModoDeteccao.MOVIMENTO
    # Histerese: liga acima de limiar_on, so desliga abaixo de limiar_off.
    limiar_on: float = 0.06
    limiar_off: float = 0.03
    # Debounce em segundos: filtra respingo de luz, sombra e vibracao.
    min_on_s: float = 0.35
    min_off_s: float = 0.35
    ordem: int = 0
    classe_objeto: str | None = None  # usado apenas no modo OBJETO

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["modo"] = self.modo.value
        d["deteccao"] = self.deteccao.value
        d["pontos"] = [list(p) for p in self.pontos]
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "ROI":
        return cls(
            nome=d["nome"],
            pontos=[tuple(p) for p in d["pontos"]],
            modo=ModoGatilho(d.get("modo", "elemento")),
            deteccao=ModoDeteccao(d.get("deteccao", "movimento")),
            limiar_on=float(d.get("limiar_on", 0.06)),
            limiar_off=float(d.get("limiar_off", 0.03)),
            min_on_s=float(d.get("min_on_s", 0.35)),
            min_off_s=float(d.get("min_off_s", 0.35)),
            ordem=int(d.get("ordem", 0)),
            classe_objeto=d.get("classe_objeto"),
        )


@dataclass
class Parametros:
    """Parametros de calculo do estudo."""

    fator_ritmo: float = 1.00          # FR - avaliacao de desempenho do operador
    fator_tolerancia: float = 0.15     # FT - pessoais + fadiga + esperas
    jornada_min: float = 528.0         # minutos produtivos por dia (8h48 - pausas)
    meta_dia: float = 550.0            # meta Grupo Prado: 550 pares/dia
    demanda_dia: float = 550.0         # usada no takt time
    pecas_por_ciclo: float = 1.0       # 1 ciclo = 1 par (ou 2, se processa o par junto)
    confianca: float = 0.95            # para o tamanho de amostra
    erro_relativo: float = 0.05        # erro admissivel (5%)
    postos: int = 1                    # postos do balanceamento de linha


@dataclass
class Estudo:
    id: str = field(default_factory=lambda: novo_id("est"))
    nome: str = "Estudo sem nome"
    unidade: str = "Itanhandu"         # Itanhandu | Guaxupe
    setor: str = ""                    # corte, pesponto, montagem, acabamento...
    produto: str = ""                  # ex.: Safety Prado bota bico composito
    posto: str = ""
    operador: str = ""
    analista: str = ""
    fonte: str = "navegador"           # navegador | webcam:0 | rtsp://... | arquivo:/...
    parametros: Parametros = field(default_factory=Parametros)
    rois: list[ROI] = field(default_factory=list)
    criado_em: float = field(default_factory=time.time)
    observacoes: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["rois"] = [r.to_dict() for r in self.rois]
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Estudo":
        p = d.get("parametros") or {}
        return cls(
            id=d.get("id") or novo_id("est"),
            nome=d.get("nome", "Estudo sem nome"),
            unidade=d.get("unidade", "Itanhandu"),
            setor=d.get("setor", ""),
            produto=d.get("produto", ""),
            posto=d.get("posto", ""),
            operador=d.get("operador", ""),
            analista=d.get("analista", ""),
            fonte=d.get("fonte", "navegador"),
            parametros=Parametros(**{k: v for k, v in p.items() if k in Parametros.__annotations__}),
            rois=[ROI.from_dict(r) for r in d.get("rois", [])],
            criado_em=float(d.get("criado_em") or time.time()),
            observacoes=d.get("observacoes", ""),
        )


@dataclass
class Leitura:
    """Um elemento medido dentro de um ciclo."""

    elemento: str
    inicio: float          # segundos desde o inicio da captura
    fim: float
    origem: str = "visao"  # visao | manual
    ciclo: int = 0
    valida: bool = True    # False = descartada como anomala (outlier)

    @property
    def duracao(self) -> float:
        return max(0.0, self.fim - self.inicio)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["duracao"] = round(self.duracao, 3)
        return d


@dataclass
class Ciclo:
    """Um ciclo completo = uma peca/par produzido."""

    numero: int
    inicio: float
    fim: float
    leituras: list[Leitura] = field(default_factory=list)
    valido: bool = True

    @property
    def duracao(self) -> float:
        return max(0.0, self.fim - self.inicio)

    def to_dict(self) -> dict[str, Any]:
        return {
            "numero": self.numero,
            "inicio": round(self.inicio, 3),
            "fim": round(self.fim, 3),
            "duracao": round(self.duracao, 3),
            "valido": self.valido,
            "leituras": [l.to_dict() for l in self.leituras],
        }
