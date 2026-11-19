#!/usr/bin/env python3
"""Roda os dois adaptadores no mesmo motor.

O CSV do funil fica na máquina de quem apresenta. Exemplo:

    python3 analisar.py --funil "/caminho/do-funil-diario.csv"
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from adaptadores import cage_aviacao, funil_vendas
from motor import relatorio

RAIZ = Path(__file__).resolve().parent


def _imprimir(doc: dict) -> None:
    print(f"\n{doc['dominio']}  ({doc['relogio']})")
    print(f"  janelas julgadas: {doc['janelas_julgadas']}")
    fracao = doc["fracao_dentro_do_objetivo"]
    if fracao == fracao:
        print(f"  fração dentro do objetivo: {fracao:.1%}")
    print(f"  MTBF: {doc['mtbf']}")
    print(f"  MTTR: {doc['mttr']}")
    print(
        f"  unidades {doc['unidades']}  falhou {doc['falhou']}  "
        f"fim sem estouro {doc['fim_sem_estouro']}  fora {doc['fora_da_amostra']}"
    )
    print(f"  weibull: {doc['weibull']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--funil", type=Path, help="CSV diário do funil, fora do Git")
    parser.add_argument("--filmes", type=Path, default=RAIZ / "data/cage/filmes.csv")
    parser.add_argument("--incidentes", type=Path, default=RAIZ / "data/cage/incidentes_mes.csv")
    parser.add_argument("--saida", type=Path, default=RAIZ / "output")
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)

    if args.funil:
        janelas, unidades = funil_vendas(args.funil)
        doc = relatorio("funil.vendas", janelas, unidades, "janela = dia; unidade = semana")
        _imprimir(doc)
        (args.saida / "funil.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    janelas, unidades = cage_aviacao(args.filmes, args.incidentes)
    doc = relatorio("cage.aviacao", janelas, unidades, "janela = mês; unidade = ano")
    _imprimir(doc)
    (args.saida / "cage.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
