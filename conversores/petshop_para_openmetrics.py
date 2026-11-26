"""PetShop Dataset (Amazon Science, CloudWatch em janelas de 5 min) -> OpenMetrics no contrato do plugin.

Adaptador para fonte já agregada por janela (não há uma linha por requisição):
- requisições boas e com erro viram o contador http_server_request_duration_seconds_count,
  o de erro com error_type="_OTHER" (convenção OTel para tipo de erro desconhecido);
- p50/p90/p95/p99 da janela viram o gauge http_server_request_duration_window_seconds{quantile}.

Uso: python conversores/petshop_para_openmetrics.py [--dados casos/petshop/data] [--saida arquivo.om]
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import pandas as pd

CENARIOS = {"low_traffic": "baixo", "high_traffic": "alto", "temporal_traffic1": "variavel"}

NOMES = {
    "PetSite": ("Site (front-end)", True),
    "PetSearch_AWS::ECS::Fargate": ("Busca de pets", True),
    "petlistadoptions_AWS::ECS::Fargate": ("Lista de adoções", True),
    "payforadoption_AWS::ECS::Container": ("Pagamento da adoção", True),
    "petInfo_AWS::DynamoDB::Table": ("Cadastro de pets (DynamoDB)", True),
    "adoptions@services-database.us-west-2.rds.amazonaws.com_Database::SQL": ("Banco de adoções (PostgreSQL)", True),
    "https://sqs.us-west-2.amazonaws.com/Services-sqspetadoption_AWS::SQS::Queue": ("Fila de adoções (SQS)", True),
    "SimpleNotificationService_AWS::SimpleNotificationService": ("Notificações (SNS)", True),
    "lambdastatusupdater_AWS::Lambda::Function": ("Atualização de status (Lambda)", True),
    "SimpleSystemsManagement_AWS::SimpleSystemsManagement": ("Parâmetros de configuração (SSM)", True),
    "AWS::StepFunctions::StateMachine": ("Fluxo de preço (Step Functions)", False),
    "Evidently_AWS::Evidently": ("Feature flags (Evidently)", False),
}
JANELA_S = 300
QUANTIS = [("p50", "0.5"), ("p90", "0.9"), ("p95", "0.95"), ("p99", "0.99")]
HIST = "http_server_request_duration_seconds"
QUANT = "http_server_request_duration_window_seconds"


def esc(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def rotulos(**kv) -> str:
    return "{" + ",".join(f'{k}="{esc(str(v))}"' for k, v in kv.items()) + "}"


def ler(pasta: Path) -> pd.DataFrame:
    df = pd.read_csv(pasta / "metrics.csv", header=[0, 1, 2], index_col=0)
    df.index = df.index.astype(float).astype(int)
    return df


def series_do_cenario(df: pd.DataFrame, cenario: str):
    comps = sorted({c[0] for c in df.columns})
    for comp in comps:
        if (comp, "requests", "Sum") not in df.columns:
            continue
        n = df[(comp, "requests", "Sum")]
        if n.fillna(0).sum() == 0:
            continue
        disp = df[(comp, "availability", "Average")] / 100.0
        janelas = []
        for t, ni, di in zip(df.index, n, disp):
            ni = 0 if pd.isna(ni) else int(round(ni))
            fi = 0 if (ni == 0 or pd.isna(di)) else int(round(ni * (1 - di)))
            qs = {}
            for nome, q in QUANTIS:
                v = df.at[t, (comp, "latency", nome)]
                if ni > 0 and not pd.isna(v):
                    qs[q] = float(v)
            janelas.append((int(t), ni, fi, qs))
        yield comp, janelas


def main():
    base = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--dados", type=Path, default=base.parent / "casos" / "petshop" / "data")
    ap.add_argument("--saida", type=Path, default=base / "saida" / "petshop.om")
    args = ap.parse_args()
    args.saida.parent.mkdir(parents=True, exist_ok=True)

    todas = []
    for pasta, nome in CENARIOS.items():
        df = ler(args.dados / pasta)
        for comp, jan in series_do_cenario(df, nome):
            todas.append((nome, comp, jan))

    linhas_hist, linhas_quant = [], []
    total_amostras = 0
    for cen, comp, jan in todas:
        t0 = jan[0][0]
        for com_erro in (False, True):
            nome, principal = NOMES.get(comp, (comp, False))
            lab = {"service_name": comp, "componente": nome, "principal": "sim" if principal else "nao",
                   "scenario": cen}
            if com_erro:
                lab["error_type"] = "_OTHER"
            acum = 0
            pontos = [(t0, 0)]
            for t, ni, fi, _ in jan:
                acum += fi if com_erro else (ni - fi)
                pontos.append((t + JANELA_S, acum))
            for t, v in pontos:
                lab_inf = dict(lab, le="+Inf")
                linhas_hist.append((rotulos(**lab_inf), "_bucket", t, v))
                linhas_hist.append((rotulos(**lab), "_count", t, v))
                total_amostras += 2
        for _, q in QUANTIS:
            nome, principal = NOMES.get(comp, (comp, False))
            lab = rotulos(service_name=comp, componente=nome, principal="sim" if principal else "nao",
                          scenario=cen, quantile=q)
            for t, ni, _, qs in jan:
                if q in qs:
                    linhas_quant.append((lab, t + JANELA_S, qs[q]))
                    total_amostras += 1

    with open(args.saida, "w", encoding="utf-8", newline="\n") as f:
        f.write(f"# TYPE {HIST} histogram\n")
        f.write(f"# UNIT {HIST} seconds\n")
        f.write(f"# HELP {HIST} Duracao das requisicoes HTTP do servidor (PetShop/CloudWatch mapeado para OTel). "
                "So o balde +Inf: o dataset nao traz duracao por requisicao.\n")
        for lab, suf, t, v in linhas_hist:
            f.write(f"{HIST}{suf}{lab} {v} {t}\n")
        f.write(f"# TYPE {QUANT} gauge\n")
        f.write(f"# UNIT {QUANT} seconds\n")
        f.write(f"# HELP {QUANT} Percentil da duracao na janela de 5 min, calculado pelo CloudWatch.\n")
        for lab, t, v in linhas_quant:
            f.write(f"{QUANT}{lab} {v!r} {t}\n")
        f.write("# EOF\n")

    print(f"{len(todas)} séries de componente, {total_amostras:,} amostras -> {args.saida}")


if __name__ == "__main__":
    main()
