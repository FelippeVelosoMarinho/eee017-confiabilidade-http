#!/usr/bin/env python3
"""Análise de confiabilidade sobre o NASA HTTP access log (EEE 017).

Relógio do estudo: timestamp original de cada requisição.
Falha: primeira janela em que a proporção de respostas 404 supera u0.
Unidade amostral: dia civil no fuso do log (-0400).
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import re
from collections import Counter
from datetime import datetime

import numpy as np
from scipy.optimize import minimize

LINE = re.compile(
    r"^(\S+) \S+ \S+ \[(\d{2}/\w{3}/\d{4}:\d{2}:\d{2}:\d{2}) ([+\-]\d{4})\] "
    r'"(\S+) (\S+?)(?: (\S+))?" (\d{3}) (\S+)'
)
TS_FMT = "%d/%b/%Y:%H:%M:%S"


def open_log(path: str):
    if path.endswith(".gz"):
        return gzip.open(path, "rt", errors="replace")
    return open(path, "r", errors="replace")


def load_requests(path: str):
    """Devolve lista de (datetime, status) e contagens de diagnóstico."""
    stamps = []
    statuses = []
    codes = Counter()
    rejected = 0
    total = 0
    with open_log(path) as handle:
        for raw in handle:
            total += 1
            line = raw.rstrip("\n")
            match = LINE.match(line)
            if not match:
                rejected += 1
                continue
            when = datetime.strptime(match.group(2), TS_FMT)
            status = int(match.group(7))
            stamps.append(when)
            statuses.append(status)
            codes[status] += 1
    order = np.argsort(np.array(stamps, dtype="datetime64[s]"))
    stamps = [stamps[i] for i in order]
    statuses = [statuses[i] for i in order]
    return stamps, statuses, codes, total, rejected


def window_table(stamps, statuses, window_min: int, min_requests: int = 30):
    """Janelas não sobrepostas, alinhadas à meia-noite, só com tráfego."""
    times = np.array(stamps, dtype="datetime64[s]")
    status = np.asarray(statuses)
    rows = []
    delta = np.timedelta64(window_min, "m")
    for day in np.unique(times.astype("datetime64[D]")):
        start = day.astype("datetime64[s]")
        end = start + np.timedelta64(1, "D")
        mask = (times >= start) & (times < end)
        day_times = times[mask]
        day_status = status[mask]
        cursor = start
        while cursor < end:
            nxt = cursor + delta
            chosen = (day_times >= cursor) & (day_times < nxt)
            count = int(np.sum(chosen))
            if count > 0:
                errors = int(np.sum(day_status[chosen] == 404))
                rows.append(
                    {
                        "day": str(day),
                        "start": str(cursor)[:16].replace("T", " "),
                        "end_min": int((nxt - start) / np.timedelta64(1, "m")),
                        "requests": count,
                        "n_404": errors,
                        "p_404": errors / count,
                        "eligible": count >= min_requests,
                    }
                )
            cursor = nxt
    return rows


def failure_times(rows, u0: float):
    """Minutos desde 00:00 até o fim da primeira janela elegível com p_404 > u0."""
    by_day = {}
    for row in rows:
        by_day.setdefault(row["day"], []).append(row)
    sample = []
    for day, windows in by_day.items():
        failed_at = None
        for row in windows:
            if row["eligible"] and row["p_404"] > u0:
                failed_at = row["end_min"]
                break
        last = windows[-1]["end_min"]
        if failed_at is None:
            sample.append(
                {
                    "day": day,
                    "t_min": last,
                    "censored": True,
                    "windows": len(windows),
                }
            )
        else:
            sample.append(
                {
                    "day": day,
                    "t_min": failed_at,
                    "censored": False,
                    "windows": len(windows),
                }
            )
    return sample


def weibull_mle(times, censored):
    """Weibull com R(t)=exp(-(t/eta)^beta). Censura à direita."""
    t = np.asarray(times, dtype=float)
    c = np.asarray(censored, dtype=bool)
    if np.any(t <= 0):
        raise ValueError("tempos precisam ser positivos")

    def nll(theta):
        log_beta, log_eta = theta
        beta = math.exp(log_beta)
        eta = math.exp(log_eta)
        z = (t / eta) ** beta
        ll = np.zeros_like(t)
        fail = ~c
        if np.any(fail):
            ll[fail] = (
                math.log(beta)
                - math.log(eta)
                + (beta - 1.0) * np.log(t[fail] / eta)
                - z[fail]
            )
        if np.any(c):
            ll[c] = -z[c]
        return -float(np.sum(ll))

    starts = []
    for beta0 in (0.6, 1.0, 1.5, 2.5):
        starts.append((math.log(beta0), math.log(np.median(t))))
    best = None
    for start in starts:
        result = minimize(nll, start, method="Nelder-Mead")
        if best is None or result.fun < best.fun:
            best = result
    beta = math.exp(best.x[0])
    eta = math.exp(best.x[1])
    return {
        "beta": beta,
        "eta_min": eta,
        "nll": best.fun,
        "converged": bool(best.success),
        "n": int(len(t)),
        "n_failures": int(np.sum(~c)),
        "n_censored": int(np.sum(c)),
    }


def kaplan_meier(times, censored):
    order = np.argsort(np.asarray(times, dtype=float), kind="mergesort")
    t = np.asarray(times, dtype=float)[order]
    c = np.asarray(censored, dtype=bool)[order]
    n = len(t)
    survival = 1.0
    points = [{"t_min": 0.0, "R": 1.0}]
    i = 0
    while i < n:
        when = t[i]
        j = i
        deaths = 0
        while j < n and t[j] == when:
            if not c[j]:
                deaths += 1
            j += 1
        at_risk = n - i
        if deaths and at_risk > 0:
            survival *= 1.0 - deaths / at_risk
            points.append({"t_min": float(when), "R": float(survival)})
        i = j
    return points


def stress_strength(proportions, u0: float, sigma: float, draws: int = 20000):
    """S ~ Normal(u0, sigma), truncada em (0, 1). L é a proporção empírica."""
    rng = np.random.default_rng(17)
    load = rng.choice(np.asarray(proportions, dtype=float), size=draws, replace=True)
    strength = rng.normal(u0, sigma, size=draws)
    strength = np.clip(strength, 1e-6, 1 - 1e-6)
    reliability = float(np.mean(strength > load))
    return {
        "R": reliability,
        "u0": u0,
        "sigma": sigma,
        "mean_load": float(np.mean(proportions)),
        "p50_load": float(np.median(proportions)),
        "p90_load": float(np.quantile(proportions, 0.90)),
        "draws": draws,
        "analytic_if_S_fixed": float(np.mean(np.asarray(proportions) <= u0)),
    }


def calibrate(rows_by_window):
    """Escolhe a janela cuja taxa de dias com falha fica mais perto de 50%."""
    candidates = []
    for window_min, rows in rows_by_window.items():
        props = np.array([row["p_404"] for row in rows if row["requests"] >= 20])
        if len(props) == 0:
            continue
        for quantile in (0.70, 0.80, 0.90, 0.95):
            u0 = float(np.quantile(props, quantile))
            sample = failure_times(rows, u0)
            n = len(sample)
            failures = sum(1 for item in sample if not item["censored"])
            rate = failures / n if n else 0.0
            times = np.array([item["t_min"] for item in sample if not item["censored"]], dtype=float)
            spread = float(np.std(times)) if len(times) > 1 else 0.0
            # prefere taxa entre 0.2 e 0.8 e tempos que não colapsam no primeiro passo
            in_band = 0.20 <= rate <= 0.80
            score = (0 if in_band else 1, abs(rate - 0.50), -spread, window_min)
            candidates.append(
                {
                    "window_min": window_min,
                    "quantile": quantile,
                    "u0": u0,
                    "days": n,
                    "days_failed": failures,
                    "failure_rate": rate,
                    "t_std_min": spread,
                    "t_median_min": float(np.median(times)) if len(times) else None,
                    "score": score,
                }
            )
    candidates.sort(key=lambda item: item["score"])
    return candidates


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", default="data/NASA_access_log_Aug95.gz")
    parser.add_argument("--window-min", type=int, default=30)
    parser.add_argument("--u0", type=float, default=0.017692813725232216)
    parser.add_argument("--calibrar", action="store_true")
    parser.add_argument("--sigma", type=float, default=0.002)
    parser.add_argument("--out", default="output")
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)

    stamps, statuses, codes, total, rejected = load_requests(args.log)
    summary = {
        "arquivo": os.path.basename(args.log),
        "linhas": total,
        "parseadas": len(stamps),
        "rejeitadas": rejected,
        "inicio": stamps[0].isoformat(sep=" "),
        "fim": stamps[-1].isoformat(sep=" "),
        "codigos": {str(k): v for k, v in sorted(codes.items())},
        "p_404_global": codes[404] / sum(codes.values()),
    }

    windows = [5, 15, 30, 60] if args.calibrar else [args.window_min]
    tables = {w: window_table(stamps, statuses, w) for w in windows}
    report = {"resumo": summary}

    if args.calibrar:
        ranked = calibrate(tables)
        report["calibracao"] = [
            {k: v for k, v in item.items() if k != "score"} for item in ranked[:12]
        ]
        chosen = ranked[0]
        window_min = chosen["window_min"]
        u0 = chosen["u0"]
    else:
        window_min = args.window_min
        props = np.array([row["p_404"] for row in tables[window_min] if row["requests"] >= 20])
        u0 = args.u0 if args.u0 >= 0 else float(np.quantile(props, 0.80))

    rows = tables[window_min]
    sample = failure_times(rows, u0)
    fit = weibull_mle(
        [item["t_min"] for item in sample],
        [item["censored"] for item in sample],
    )
    km = kaplan_meier(
        [item["t_min"] for item in sample],
        [item["censored"] for item in sample],
    )
    props = [row["p_404"] for row in rows if row["requests"] >= 20]
    ss = stress_strength(props, u0, args.sigma)

    report["escolha"] = {
        "janela_min": window_min,
        "u0": u0,
        "classe_erro": 404,
        "regra": "falha se a proporção de 404 na janela supera u0",
    }
    report["weibull"] = fit
    report["kaplan_meier"] = km
    report["carga_resistencia"] = ss
    report["amostra"] = sample

    with open(os.path.join(args.out, "relatorio.json"), "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
    with open(os.path.join(args.out, "janelas.csv"), "w", encoding="utf-8") as handle:
        handle.write("day,start,requests,n_404,p_404\n")
        for row in rows:
            handle.write(
                f"{row['day']},{row['start']},{row['requests']},{row['n_404']},{row['p_404']:.6f}\n"
            )
    with open(os.path.join(args.out, "tempos_ate_falha.csv"), "w", encoding="utf-8") as handle:
        handle.write("day,t_min,censored,windows\n")
        for item in sample:
            handle.write(
                f"{item['day']},{item['t_min']},{str(item['censored']).lower()},{item['windows']}\n"
            )

    print(json.dumps({k: report[k] for k in ("resumo", "escolha", "weibull", "carga_resistencia")}, indent=2, ensure_ascii=False))
    if "calibracao" in report:
        print("--- calibracao ---")
        for item in report["calibracao"][:8]:
            print(
                f"janela={item['window_min']:>2} min  "
                f"q={item['quantile']:.2f}  u0={item['u0']:.4f}  "
                f"falhas={item['days_failed']}/{item['days']} ({item['failure_rate']:.0%})  "
                f"mediana t={item['t_median_min']}"
            )


if __name__ == "__main__":
    main()
