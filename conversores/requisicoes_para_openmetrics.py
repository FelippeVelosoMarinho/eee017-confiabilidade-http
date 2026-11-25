"""Log de requisições (uma linha por requisição) -> OpenMetrics no contrato do plugin.

Adaptador genérico: o que muda de uma fonte para outra fica num arquivo de
configuração JSON (colunas, formato do horário, regra de erro, rótulos, baldes).
Veja conversores/configs/huggingface.json.

Contrato de saída (convenções semânticas do OpenTelemetry para HTTP, nomes do Prometheus):

    http_server_request_duration_seconds_bucket{..., le="0.2"}   contador acumulado
    http_server_request_duration_seconds_count{...}              contador acumulado
    http_server_request_duration_seconds_sum{...}                soma acumulada (s)

A requisição com falha no modo erro leva o rótulo error_type (o valor da coluna de erro,
por exemplo o código 5xx). Assim, total = count e erros = count{error_type!=""},
qualquer que seja a fonte.

Amostras esparsas: todas as séries recebem um zero um dia antes do primeiro dia do conjunto
e depois uma amostra só quando o contador muda. O Prometheus precisa rodar com
--query.lookback-delta maior que a duração do conjunto (o conversor imprime o mínimo; o lab usa 60d). Com isso, o valor do
contador em qualquer instante é exato, e o painel, no modo "acumulado", tira a contagem
de qualquer janela (5 min, 1 h, 24 h) pela diferença entre dois pontos.

Uso (só biblioteca padrão):
    python -I conversores/requisicoes_para_openmetrics.py \
        --config conversores/configs/huggingface.json \
        --entrada casos/huggingface/dados/access_logs.csv \
        --saida /tmp/huggingface.om
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

HIST = "http_server_request_duration_seconds"


def esc(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def rotulos(d: dict) -> str:
    return "{" + ",".join(f'{k}="{esc(str(v))}"' for k, v in sorted(d.items())) + "}"


def fmt_le(b: float) -> str:
    return format(b, "g")


def ler_eventos(cfg: dict, entrada: Path):
    col = cfg["colunas"]
    fmt = cfg.get("formato_tempo", "%Y-%m-%d %H:%M:%S")
    escala = {"ms": 1e-3, "s": 1.0, "us": 1e-6}[cfg.get("unidade_duracao", "ms")]
    erro = cfg["erro"]
    re_erro = re.compile(erro["regex"])
    mapas = cfg.get("mapas", {})
    rot_cfg = cfg["rotulos"]  # {"rotulo_prometheus": "coluna_do_csv"}
    fixos = cfg.get("rotulos_fixos", {})

    with open(entrada, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            ts = datetime.strptime(r[col["tempo"]], fmt).replace(tzinfo=timezone.utc)
            dur = float(r[col["duracao"]]) * escala
            labs = dict(fixos)
            for rot, coluna in rot_cfg.items():
                v = r[coluna]
                labs[rot] = mapas.get(coluna, {}).get(v, v)
            v_erro = r[erro["coluna"]]
            if re_erro.search(v_erro):
                labs["error_type"] = v_erro
            yield int(ts.timestamp()), tuple(sorted(labs.items())), dur


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", type=Path, required=True)
    ap.add_argument("--entrada", type=Path, required=True)
    ap.add_argument("--saida", type=Path, required=True)
    args = ap.parse_args()

    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    buckets = sorted(float(b) for b in cfg["baldes_segundos"])
    les = [fmt_le(b) for b in buckets] + ["+Inf"]

    por_serie: dict[tuple, dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))
    n_linhas = 0
    for ts, key, dur in ler_eventos(cfg, args.entrada):
        por_serie[key][ts].append(dur)
        n_linhas += 1
    if n_linhas == 0:
        print("nenhuma linha lida", file=sys.stderr)
        return 1

    primeiro = min(t for eventos in por_serie.values() for t in eventos)
    ultimo = max(t for eventos in por_serie.values() for t in eventos)
    inicio = (primeiro // 86400 - 1) * 86400
    print(
        f"zero em {datetime.fromtimestamp(inicio, tz=timezone.utc):%Y-%m-%d %H:%M} UTC; "
        f"o --query.lookback-delta do Prometheus precisa passar de {(ultimo - inicio) / 86400:.0f} dias",
        file=sys.stderr,
    )

    args.saida.parent.mkdir(parents=True, exist_ok=True)
    amostras = 0
    finais = Counter()
    erros_finais = 0
    with open(args.saida, "w", encoding="utf-8", newline="\n") as out:
        out.write(f"# TYPE {HIST} histogram\n")
        out.write(f"# UNIT {HIST} seconds\n")
        out.write(f"# HELP {HIST} Duracao das requisicoes HTTP do servidor (log convertido para a convencao OTel).\n")
        for key in sorted(por_serie):
            eventos = por_serie[key]
            labs = dict(key)
            instantes = sorted(eventos)
            # Estado acumulado em cada instante com evento, mais um zero 1 s antes do primeiro.
            # Todas as séries começam com zero no mesmo instante, um dia antes do primeiro dia
            # do conjunto. Sem isso, a soma não existe antes do primeiro evento e a primeira
            # janela do período se perde na diferença do contador acumulado.
            # A amostra vai 1 ms depois do evento: o Prometheus inclui no valor em t a amostra
            # exatamente em t, então um evento às 00:00:00 cairia na janela anterior. Com o
            # deslocamento, a janela fica [início, fim), como a contagem por data no Colab.
            pontos = [(inicio, [0] * len(les), 0, 0.0)]
            acum = [0] * len(les)
            cont = 0
            soma = 0.0
            for t in instantes:
                for d in eventos[t]:
                    for i, b in enumerate(buckets):
                        if d <= b:
                            acum[i] += 1
                    acum[-1] += 1
                    cont += 1
                    soma += d
                pontos.append((t + 0.001, list(acum), cont, soma))
            for i, le in enumerate(les):
                lb = rotulos({**labs, "le": le})
                for t, bs, _, _ in pontos:
                    out.write(f"{HIST}_bucket{lb} {bs[i]} {t:.3f}\n")
                    amostras += 1
            lb = rotulos(labs)
            for t, _, c, _ in pontos:
                out.write(f"{HIST}_count{lb} {c} {t:.3f}\n")
                amostras += 1
            for t, _, _, s in pontos:
                out.write(f"{HIST}_sum{lb} {s:.6f} {t:.3f}\n")
                amostras += 1
            finais[labs.get("server_address", "")] += cont
            if "error_type" in labs:
                erros_finais += cont
        out.write("# EOF\n")

    assert sum(finais.values()) == n_linhas, "total final diferente do número de linhas"
    print(
        f"{n_linhas} requisições, {erros_finais} com error_type, {len(por_serie)} séries, "
        f"{amostras:,} amostras -> {args.saida}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
