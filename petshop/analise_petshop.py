from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker
import numpy as np
import pandas as pd
from scipy import optimize, stats

SLO_ERRO = 0.99
SLO_LAT = 0.95
TAU_S = 0.200
MIN_REQ = 100
JANELA_MIN = 5
ALVO = "PetSite"
BLOCO_BOOT = 12
N_BOOT = 2000
SEED = 17

CENARIOS = {
    "low_traffic": "Tráfego baixo",
    "high_traffic": "Tráfego alto",
    "temporal_traffic1": "Tráfego variável",
}
PERCENTIS = [(0.50, "p50"), (0.90, "p90"), (0.95, "p95"), (0.99, "p99")]

COR = {
    "serie": "#2a78d6", "serie2": "#eb6834", "serie3": "#1baf7a",
    "critico": "#d03b3b", "tinta": "#0b0b0b", "tinta2": "#52514e",
    "mudo": "#898781", "grade": "#e1e0d9", "eixo": "#c3c2b7", "fundo": "#fcfcfb",
}


def ler_cenario(pasta: Path) -> pd.DataFrame:
    df = pd.read_csv(pasta / "metrics.csv", header=[0, 1, 2], index_col=0)
    df.index = pd.to_datetime(df.index.astype(float), unit="s", utc=True)
    df.index.name = "inicio_janela_utc"
    return df


def serie_componente(df: pd.DataFrame, comp: str) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    out["n"] = df[(comp, "requests", "Sum")].fillna(0).round().astype(int)
    disp = df[(comp, "availability", "Average")] / 100.0
    out["f_erro"] = (out["n"] * (1 - disp)).round().fillna(0).astype(int)
    for _, nome in PERCENTIS:
        out[nome] = df[(comp, "latency", nome)]
    return out


def ic_binomial(f: int, n: int, conf: float = 0.95) -> tuple[float, float]:
    if n == 0:
        return (np.nan, np.nan)
    z = stats.norm.ppf(0.5 + conf / 2)
    p = f / n
    den = 1 + z**2 / n
    centro = (p + z**2 / (2 * n)) / den
    meia = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / den
    return (1 - (centro + meia), 1 - (centro - meia))


def ic_bootstrap_blocos(n: np.ndarray, f: np.ndarray, rng: np.random.Generator) -> tuple[float, float]:
    m = len(n)
    k = int(np.ceil(m / BLOCO_BOOT))
    inicios_possiveis = np.arange(m - BLOCO_BOOT + 1)
    rs = np.empty(N_BOOT)
    for b in range(N_BOOT):
        ini = rng.choice(inicios_possiveis, size=k)
        idx = (ini[:, None] + np.arange(BLOCO_BOOT)[None, :]).ravel()[:m]
        rs[b] = 1 - f[idx].sum() / n[idx].sum()
    return tuple(np.quantile(rs, [0.025, 0.975]))


def fracao_ate_tau(linha: pd.Series, tau: float) -> tuple[float, float, float]:
    pontos = [(q, linha[nome]) for q, nome in PERCENTIS]
    if any(pd.isna(v) for _, v in pontos):
        return (np.nan, np.nan, np.nan)
    lo, hi = 0.0, 1.0
    for q, v in pontos:
        if v <= tau:
            lo = max(lo, q)
        else:
            hi = min(hi, q)
    xs = [0.0] + [v for _, v in pontos]
    ys = [0.0] + [q for q, _ in pontos]
    est = float(np.interp(tau, xs, ys, right=hi))
    est = min(max(est, lo), hi)
    return (lo, hi, est)


def episodios(ruim: np.ndarray) -> list[tuple[int, int]]:
    eps, ini = [], None
    for i, r in enumerate(ruim):
        if r and ini is None:
            ini = i
        elif not r and ini is not None:
            eps.append((ini, i - ini))
            ini = None
    if ini is not None:
        eps.append((ini, len(ruim) - ini))
    return eps


def corridas(ruim: np.ndarray) -> tuple[list[tuple[int, bool]], list[tuple[int, bool]]]:
    boas, ruins = [], []
    m = len(ruim)
    i = 0
    while i < m:
        j = i
        while j < m and ruim[j] == ruim[i]:
            j += 1
        cens = i == 0 or j == m
        (ruins if ruim[i] else boas).append((j - i, cens))
        i = j
    return boas, ruins


def indices_janela(s: pd.DataFrame, tau: float = TAU_S) -> pd.DataFrame:
    s = s.copy()
    s["julgada"] = s["n"] >= MIN_REQ
    s["r_erro"] = 1 - s["f_erro"] / s["n"].where(s["n"] > 0)
    s["ruim_erro"] = s["julgada"] & (s["r_erro"] < SLO_ERRO)
    s["ruim_lat"] = s["julgada"] & (s["p95"] > tau)
    s["ruim"] = s["ruim_erro"] | s["ruim_lat"]
    return s


def resumo_modo(s: pd.DataFrame, col: str) -> dict:
    j = s[s["julgada"]]
    ruim = j[col].to_numpy()
    eps = episodios(ruim)
    boas = int((~ruim).sum())
    mttr = float(np.mean([c for _, c in eps]) * JANELA_MIN) if eps else np.nan
    mtbf = float(boas / len(eps) * JANELA_MIN) if eps else np.nan
    return {
        "janelas_julgadas": int(len(j)),
        "janelas_ok": boas,
        "A": boas / len(j) if len(j) else np.nan,
        "episodios": len(eps),
        "MTBF_min": mtbf,
        "MTTR_min": mttr,
        "A_pela_identidade": mtbf / (mtbf + mttr) if eps else np.nan,
    }


def ajustar(t: np.ndarray, cens: np.ndarray) -> dict:
    obs = ~cens

    def nll_exp(log_lam):
        lam = np.exp(log_lam[0])
        return -(obs.sum() * np.log(lam) - lam * t.sum())

    def nll_wei(par):
        k, esc = np.exp(par)
        z = (t / esc) ** k
        ll = (np.log(k / esc) + (k - 1) * np.log(t / esc))[obs].sum() - z.sum()
        return -ll

    r_exp = optimize.minimize(nll_exp, [np.log(1 / t.mean())], method="Nelder-Mead")
    r_wei = optimize.minimize(nll_wei, [0.0, np.log(t.mean())], method="Nelder-Mead")
    lam = float(np.exp(r_exp.x[0]))
    k, esc = (float(v) for v in np.exp(r_wei.x))
    lr = 2 * (r_exp.fun - r_wei.fun)
    return {
        "n": int(len(t)), "censuradas": int(cens.sum()),
        "exp_lambda_por_h": lam * 60, "exp_media_h": 1 / lam / 60,
        "exp_AIC": 2 * 1 + 2 * r_exp.fun,
        "weibull_k": k, "weibull_escala_h": esc / 60,
        "weibull_AIC": 2 * 2 + 2 * r_wei.fun,
        "razao_verossimilhanca": float(lr), "p_valor_k_igual_1": float(stats.chi2.sf(lr, 1)),
    }


def kaplan_meier(t: np.ndarray, cens: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ordem = np.argsort(t)
    t, cens = t[ordem], cens[ordem]
    tempos = np.unique(t[~cens])
    s, ys = 1.0, []
    for u in tempos:
        risco = (t >= u).sum()
        mortes = ((t == u) & ~cens).sum()
        s *= 1 - mortes / risco
        ys.append(s)
    return np.concatenate([[0], tempos]), np.concatenate([[1], ys])


def estilo(ax):
    ax.set_facecolor(COR["fundo"])
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    for lado in ("left", "bottom"):
        ax.spines[lado].set_color(COR["eixo"])
    ax.tick_params(colors=COR["tinta2"], labelsize=8)
    ax.grid(axis="y", color=COR["grade"], linewidth=0.6)
    ax.set_axisbelow(True)


def sombrear_episodios(ax, s: pd.DataFrame, col: str):
    j = s[s["julgada"]]
    for ini, comp in episodios(j[col].to_numpy()):
        t0 = j.index[ini]
        t1 = j.index[ini + comp - 1] + pd.Timedelta(minutes=JANELA_MIN)
        ax.axvspan(t0, t1, color=COR["critico"], alpha=0.25, linewidth=0)


def fig_erro(series: dict, saida: Path):
    fig, axes = plt.subplots(len(series), 1, figsize=(9, 2.2 * len(series)), facecolor=COR["fundo"])
    for ax, (cen, s) in zip(axes, series.items()):
        estilo(ax)
        sombrear_episodios(ax, s, "ruim_erro")
        r = s["r_erro"].clip(lower=0.95)
        ax.plot(s.index, r, color=COR["serie"], linewidth=1.0)
        ax.axhline(SLO_ERRO, color=COR["tinta2"], linestyle="--", linewidth=1)
        ax.set_ylim(0.95, 1.002)
        ax.set_title(f"{CENARIOS[cen]} — {s['ruim_erro'].sum()} janelas abaixo de 99%", loc="left",
                     fontsize=9, color=COR["tinta"])
        ax.set_ylabel("R_erro", fontsize=8, color=COR["tinta2"])
    axes[-1].set_xlabel("Horário (UTC)", fontsize=8, color=COR["tinta2"])
    fig.suptitle("PetSite: R_erro por janela de 5 min (tracejado = meta 99%; faixas = episódios)\n"
                 "Valores abaixo de 95% aparecem no piso do gráfico", fontsize=9, x=0.01, ha="left",
                 color=COR["tinta"])
    fig.tight_layout()
    fig.savefig(saida, dpi=200)
    plt.close(fig)


def fig_latencia(series: dict, saida: Path):
    fig, axes = plt.subplots(len(series), 1, figsize=(9, 2.2 * len(series)), facecolor=COR["fundo"])
    for ax, (cen, s) in zip(axes, series.items()):
        estilo(ax)
        ax.plot(s.index, s["p95"] * 1000, color=COR["serie"], linewidth=1.0)
        ax.axhline(TAU_S * 1000, color=COR["tinta2"], linestyle="--", linewidth=1)
        acima = (s["p95"] > TAU_S).mean()
        ax.set_title(f"{CENARIOS[cen]} — p95 acima de {TAU_S*1000:.0f} ms em {acima:.0%} das janelas",
                     loc="left", fontsize=9, color=COR["tinta"])
        ax.set_ylabel("p95 (ms)", fontsize=8, color=COR["tinta2"])
        ax.set_ylim(0, min(800, s["p95"].max() * 1000 * 1.05))
    axes[-1].set_xlabel("Horário (UTC)", fontsize=8, color=COR["tinta2"])
    fig.suptitle("PetSite: p95 da latência por janela de 5 min (tracejado = τ = 200 ms)",
                 fontsize=9, x=0.01, ha="left", color=COR["tinta"])
    fig.tight_layout()
    fig.savefig(saida, dpi=200)
    plt.close(fig)


def fig_componentes(tab: pd.DataFrame, saida: Path):
    t = tab.sort_values("R_erro").reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(8, 0.32 * len(t) + 1.2), facecolor=COR["fundo"])
    estilo(ax)
    ax.grid(axis="x", color=COR["grade"], linewidth=0.6)
    ax.grid(axis="y", visible=False)
    y = np.arange(len(t))
    ax.errorbar(t["R_erro"], y, xerr=[t["R_erro"] - t["IC95_inf"], t["IC95_sup"] - t["R_erro"]],
                fmt="o", color=COR["serie"], markersize=4, elinewidth=1.2, capsize=0)
    ax.set_yticks(y, t["componente"], fontsize=7, color=COR["tinta"])
    ax.xaxis.set_major_locator(matplotlib.ticker.MaxNLocator(5))
    ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v*100:.2f}%"))
    ax.set_xlabel("R_erro = 1 − erros/requisições (barra = IC 95% de Wilson)", fontsize=8, color=COR["tinta2"])
    fig.suptitle("R_erro por componente do caminho síncrono (três cenários somados)", x=0.01, ha="left",
                 fontsize=9, color=COR["tinta"])
    fig.tight_layout()
    fig.savefig(saida, dpi=200)
    plt.close(fig)


def fig_sobrevivencia(t_h: np.ndarray, cens: np.ndarray, aj: dict, saida: Path):
    fig, ax = plt.subplots(figsize=(7, 4), facecolor=COR["fundo"])
    estilo(ax)
    x, y = kaplan_meier(t_h, cens)
    ax.step(x, y, where="post", color=COR["tinta"], linewidth=2, label="Empírica (Kaplan–Meier)")
    g = np.linspace(0, t_h.max() * 1.05, 300)
    ax.plot(g, np.exp(-g / aj["exp_media_h"]), color=COR["serie2"], linewidth=2,
            label=f"Exponencial (média {aj['exp_media_h']:.1f} h)")
    ax.plot(g, np.exp(-(g / aj["weibull_escala_h"]) ** aj["weibull_k"]), color=COR["serie3"], linewidth=2,
            label=f"Weibull (k = {aj['weibull_k']:.2f})")
    ax.set_xlabel("Tempo dentro do SLO de erro até o próximo episódio (h)", fontsize=8, color=COR["tinta2"])
    ax.set_ylabel("Fração que ainda não falhou", fontsize=8, color=COR["tinta2"])
    ax.set_ylim(0, 1.02)
    ax.legend(fontsize=8, frameon=False)
    ax.set_title("PetSite: tempo entre falhas, três cenários somados", loc="left", fontsize=9,
                 color=COR["tinta"])
    fig.tight_layout()
    fig.savefig(saida, dpi=200)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    base = Path(__file__).resolve().parent
    ap.add_argument("--dados", type=Path, default=base / "data")
    ap.add_argument("--saida", type=Path, default=base / "resultados")
    args = ap.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)

    brutos = {c: ler_cenario(args.dados / c) for c in CENARIOS}
    alvo = {c: indices_janela(serie_componente(df, ALVO)) for c, df in brutos.items()}

    linhas, eps_linhas = [], []
    tbf, tbf_cens = [], []
    for cen, s in alvo.items():
        j = s[s["julgada"]]
        n, f = int(j["n"].sum()), int(j["f_erro"].sum())
        bin_lo, bin_hi = ic_binomial(f, n)
        boot_lo, boot_hi = ic_bootstrap_blocos(j["n"].to_numpy(), j["f_erro"].to_numpy(), rng)
        lat = np.array([fracao_ate_tau(r, TAU_S) for _, r in j.iterrows()])
        w = j["n"].to_numpy()
        linha = {
            "cenario": CENARIOS[cen],
            "inicio_utc": str(s.index[0]), "fim_utc": str(s.index[-1] + pd.Timedelta(minutes=JANELA_MIN)),
            "janelas": len(s), "janelas_abaixo_de_100": int((~s["julgada"]).sum()),
            "requisicoes": n, "erros": f,
            "R_erro": 1 - f / n, "R_erro_IC95_wilson": [bin_lo, bin_hi], "R_erro_IC95_bootstrap": [boot_lo, boot_hi],
            "R_lat_limite_inf": float(np.average(lat[:, 0], weights=w)),
            "R_lat_limite_sup": float(np.average(lat[:, 1], weights=w)),
            "R_lat_estimado": float(np.average(lat[:, 2], weights=w)),
            "p95_mediano_ms": float(j["p95"].median() * 1000), "p99_mediano_ms": float(j["p99"].median() * 1000),
        }
        for modo, col in (("erro", "ruim_erro"), ("lat", "ruim_lat"), ("ambos", "ruim")):
            linha[modo] = resumo_modo(s, col)
        linhas.append(linha)

        ruim = j["ruim_erro"].to_numpy()
        for ini, comp in episodios(ruim):
            eps_linhas.append({"cenario": CENARIOS[cen], "inicio_utc": str(j.index[ini]),
                               "janelas": comp, "duracao_min": comp * JANELA_MIN,
                               "R_erro_pior_janela": float(j["r_erro"].iloc[ini:ini + comp].min()),
                               "erros": int(j["f_erro"].iloc[ini:ini + comp].sum())})
        boas, _ = corridas(ruim)
        tbf += [c * JANELA_MIN for c, _ in boas]
        tbf_cens += [cz for _, cz in boas]

    eps_df = pd.DataFrame(eps_linhas)
    eps_df.to_csv(args.saida / "episodios_erro_petsite.csv", index=False)

    testes = {}
    tab = np.array([[l["erros"], l["requisicoes"] - l["erros"]] for l in linhas])
    chi, p, gl, _ = stats.chi2_contingency(tab)
    testes["entre_cenarios"] = {"qui2": float(chi), "gl": int(gl), "p": float(p),
                                "taxas_erro": {l["cenario"]: l["erros"] / l["requisicoes"] for l in linhas}}
    for cen, s in alvo.items():
        j = s[s["julgada"]]
        t2 = np.column_stack([j["f_erro"], j["n"] - j["f_erro"]])
        t2 = t2[t2.sum(axis=1) > 0]
        chi, p, gl, esp = stats.chi2_contingency(t2)
        f = j["f_erro"].to_numpy(); n = j["n"].to_numpy(); pbar = f.sum() / n.sum()
        disp = float(f.var(ddof=1) / np.mean(n * pbar * (1 - pbar)))
        testes[f"entre_janelas_{cen}"] = {"qui2": float(chi), "gl": int(gl), "p": float(p),
                                          "indice_dispersao": disp,
                                          "obs": "esperados pequenos: p é aproximado; ver índice de dispersão"}

    comps = sorted({c[0] for df in brutos.values() for c in df.columns})
    comp_linhas = []
    for comp in comps:
        n = f = jul = ok = 0
        for df in brutos.values():
            if (comp, "requests", "Sum") not in df.columns:
                continue
            s = indices_janela(serie_componente(df, comp))
            n += int(s["n"].sum()); f += int(s["f_erro"].sum())
            jul += int(s["julgada"].sum()); ok += int((s["julgada"] & ~s["ruim_erro"]).sum())
        if n == 0:
            continue
        lo, hi = ic_binomial(f, n)
        comp_linhas.append({"componente": comp, "requisicoes": n, "erros": f, "R_erro": 1 - f / n,
                            "IC95_inf": lo, "IC95_sup": hi, "janelas_julgadas": jul,
                            "A_erro": ok / jul if jul else np.nan})
    comp_df = pd.DataFrame(comp_linhas).sort_values("R_erro")
    comp_df["grupo"] = np.where(comp_df["janelas_julgadas"] > 0, "caminho_sincrono", "baixo_volume_ou_assincrono")
    comp_df.to_csv(args.saida / "R_por_componente.csv", index=False)
    grandes = comp_df[comp_df["grupo"] == "caminho_sincrono"]
    t3 = np.column_stack([grandes["erros"], grandes["requisicoes"] - grandes["erros"]])
    chi, p, gl, _ = stats.chi2_contingency(t3)
    sem_alvo = grandes[grandes["componente"] != ALVO]
    t4 = np.column_stack([sem_alvo["erros"], sem_alvo["requisicoes"] - sem_alvo["erros"]])
    chi4, p4, gl4, _ = stats.chi2_contingency(t4)
    testes["entre_componentes"] = {"qui2": float(chi), "gl": int(gl), "p": float(p),
                                   "componentes": int(len(grandes)),
                                   "criterio": "componentes com alguma janela de >= 100 requisições",
                                   "sem_PetSite": {"qui2": float(chi4), "gl": int(gl4), "p": float(p4)},
                                   "erros_PetSite": int(grandes.loc[grandes["componente"] == ALVO, "erros"].sum()),
                                   "erros_demais": int(sem_alvo["erros"].sum())}

    t_arr = np.array(tbf, float); c_arr = np.array(tbf_cens, bool)
    aj = ajustar(t_arr, c_arr)

    sens = []
    for tau in (0.200, 0.250, 0.300, 0.350, 0.400, 0.500):
        for cen, s in alvo.items():
            r = resumo_modo(indices_janela(s[["n", "f_erro"] + [n for _, n in PERCENTIS]], tau), "ruim_lat")
            sens.append({"tau_ms": int(tau * 1000), "cenario": CENARIOS[cen], "A_lat": r["A"],
                         "episodios": r["episodios"], "MTTR_min": r["MTTR_min"]})
    pd.DataFrame(sens).to_csv(args.saida / "sensibilidade_tau.csv", index=False)

    resumo = {"parametros": {"SLO_erro": SLO_ERRO, "SLO_lat": SLO_LAT, "tau_ms": TAU_S * 1000,
                             "min_req": MIN_REQ, "janela_min": JANELA_MIN, "alvo": ALVO,
                             "bootstrap": f"{N_BOOT} reamostras, blocos de {BLOCO_BOOT} janelas, seed {SEED}"},
              "por_cenario": linhas, "testes_qui2": testes, "ajuste_tempo_entre_falhas": aj}
    (args.saida / "resumo.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=2, default=float),
                                           encoding="utf-8")

    plano = []
    for l in linhas:
        plano.append({"cenario": l["cenario"], "requisicoes": l["requisicoes"], "erros": l["erros"],
                      "R_erro": l["R_erro"],
                      "IC95_wilson": f"[{l['R_erro_IC95_wilson'][0]:.4%}; {l['R_erro_IC95_wilson'][1]:.4%}]",
                      "IC95_bootstrap": f"[{l['R_erro_IC95_bootstrap'][0]:.4%}; {l['R_erro_IC95_bootstrap'][1]:.4%}]",
                      "R_lat_faixa": f"[{l['R_lat_limite_inf']:.0%}; {l['R_lat_limite_sup']:.0%}]",
                      "R_lat_estimado": l["R_lat_estimado"],
                      **{f"{m}_{k}": l[m][k] for m in ("erro", "lat", "ambos")
                         for k in ("A", "episodios", "MTBF_min", "MTTR_min")}})
    pd.DataFrame(plano).to_csv(args.saida / "indices_petsite.csv", index=False)

    fig_erro(alvo, args.saida / "fig1_R_erro_por_janela.png")
    fig_latencia(alvo, args.saida / "fig2_p95_por_janela.png")
    fig_componentes(grandes, args.saida / "fig3_R_erro_por_componente.png")
    fig_sobrevivencia(t_arr / 60, c_arr, aj, args.saida / "fig4_tempo_entre_falhas.png")

    print(json.dumps(resumo, ensure_ascii=False, indent=1, default=float))


if __name__ == "__main__":
    main()
