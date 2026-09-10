"""Persistencia em SQLite - um arquivo unico, facil de levar para o Odoo/Power BI.

Duas tabelas:
    estudos  - a configuracao (posto, produto, ROIs, parametros)
    medicoes - cada captura realizada, com ciclos e analise congelados
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from .models import Estudo, novo_id

ESQUEMA = """
CREATE TABLE IF NOT EXISTS estudos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    unidade TEXT,
    setor TEXT,
    produto TEXT,
    posto TEXT,
    criado_em REAL,
    json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS medicoes (
    id TEXT PRIMARY KEY,
    estudo_id TEXT NOT NULL,
    iniciada_em REAL,
    finalizada_em REAL,
    duracao_s REAL,
    ciclos INTEGER,
    tempo_padrao_s REAL,
    json TEXT NOT NULL,
    FOREIGN KEY (estudo_id) REFERENCES estudos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_medicoes_estudo ON medicoes(estudo_id);
"""


class Banco:
    def __init__(self, caminho: str | Path = "cronoanalise.db"):
        self.caminho = str(caminho)
        self._conn = sqlite3.connect(self.caminho, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(ESQUEMA)
        self._conn.commit()

    # ---------------------------------------------------------------- #
    def salvar_estudo(self, estudo: Estudo) -> Estudo:
        d = estudo.to_dict()
        self._conn.execute(
            "INSERT INTO estudos (id, nome, unidade, setor, produto, posto, criado_em, json)"
            " VALUES (?,?,?,?,?,?,?,?)"
            " ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, unidade=excluded.unidade,"
            " setor=excluded.setor, produto=excluded.produto, posto=excluded.posto,"
            " json=excluded.json",
            (estudo.id, estudo.nome, estudo.unidade, estudo.setor, estudo.produto,
             estudo.posto, estudo.criado_em, json.dumps(d, ensure_ascii=False)),
        )
        self._conn.commit()
        return estudo

    def obter_estudo(self, estudo_id: str) -> Estudo | None:
        row = self._conn.execute("SELECT json FROM estudos WHERE id=?", (estudo_id,)).fetchone()
        return Estudo.from_dict(json.loads(row["json"])) if row else None

    def listar_estudos(self) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT e.json, "
            " (SELECT COUNT(*) FROM medicoes m WHERE m.estudo_id = e.id) AS medicoes "
            "FROM estudos e ORDER BY e.criado_em DESC").fetchall()
        out = []
        for r in rows:
            d = json.loads(r["json"])
            d["medicoes"] = r["medicoes"]
            out.append(d)
        return out

    def remover_estudo(self, estudo_id: str) -> None:
        self._conn.execute("DELETE FROM medicoes WHERE estudo_id=?", (estudo_id,))
        self._conn.execute("DELETE FROM estudos WHERE id=?", (estudo_id,))
        self._conn.commit()

    # ---------------------------------------------------------------- #
    def salvar_medicao(self, estudo_id: str, resumo: dict[str, Any],
                       iniciada_em: float | None = None,
                       finalizada_em: float | None = None) -> str:
        mid = novo_id("med")
        analise = resumo.get("analise", {})
        self._conn.execute(
            "INSERT INTO medicoes (id, estudo_id, iniciada_em, finalizada_em, duracao_s,"
            " ciclos, tempo_padrao_s, json) VALUES (?,?,?,?,?,?,?,?)",
            (mid, estudo_id, iniciada_em or time.time(), finalizada_em or time.time(),
             analise.get("producao", {}).get("duracao_captura_s", 0.0),
             analise.get("ciclos", {}).get("n", 0),
             analise.get("tempos", {}).get("tempo_padrao_s", 0.0),
             json.dumps(resumo, ensure_ascii=False)),
        )
        self._conn.commit()
        return mid

    def listar_medicoes(self, estudo_id: str) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT id, iniciada_em, finalizada_em, duracao_s, ciclos, tempo_padrao_s"
            " FROM medicoes WHERE estudo_id=? ORDER BY iniciada_em DESC", (estudo_id,)).fetchall()
        return [dict(r) for r in rows]

    def obter_medicao(self, medicao_id: str) -> dict[str, Any] | None:
        row = self._conn.execute("SELECT json FROM medicoes WHERE id=?", (medicao_id,)).fetchone()
        return json.loads(row["json"]) if row else None

    def fechar(self) -> None:
        self._conn.close()
