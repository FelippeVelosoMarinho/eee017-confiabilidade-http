#!/usr/bin/env python3
"""Grava no arquivo lido pelo Promtail os dias usados como exemplo.

O timestamp de cada linha permanece o de agosto de 1995. A taxa vista no
Grafana é a taxa do log, na janela de 30 minutos, e não um relógio acelerado.
"""

from __future__ import annotations

import argparse
import gzip
import os
import re

STAMP = re.compile(r"\[(\d{2})/Aug/1995:")


def open_log(path: str):
    if path.endswith(".gz"):
        return gzip.open(path, "rt", errors="replace")
    return open(path, "r", errors="replace")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", default="data/NASA_access_log_Aug95.gz")
    parser.add_argument("--out", default="logs/app.log")
    parser.add_argument("--days", default="06,09", help="dias de agosto, separados por vírgula")
    args = parser.parse_args()
    wanted = {piece.strip().zfill(2) for piece in args.days.split(",") if piece.strip()}
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    kept = 0
    with open_log(args.log) as source, open(args.out, "w", encoding="utf-8") as target:
        for line in source:
            match = STAMP.search(line)
            if match and match.group(1) in wanted:
                target.write(line if line.endswith("\n") else line + "\n")
                kept += 1
    print(f"{kept} linhas de {sorted(wanted)} gravadas em {args.out}")


if __name__ == "__main__":
    main()
