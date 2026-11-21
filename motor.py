"""Motor único. O adaptador escolhe o relógio e o que é estouro.

t está na unidade da janela (dia, mês). 1440 só vale quando a janela é o minuto.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np
from scipy.optimize import minimize
from scipy.stats import scoreatpercentile


@dataclass
class Janela:
    id: str
    ordem: int
    valor: float
    elegivel: bool
    ruim: bool | None  # None = sem julgamento (histórico curto ou sem tráfego)


@dataclass
class Unidade:
    id: str
    t: float
    censurada: bool
    excluida: bool


def percentil_anterior(valores: list[float], indice: int, p: float, minimo: int) -> float | None:
    """Percentil dos valores estritamente anteriores. Não usa o ponto julgado."""
    if indice < minimo:
        return None
    return float(scoreatpercentile(valores[:indice], p))


def episodios(ruins: list[bool]) -> tuple[float | None, float | None, float, int]:
    """MTBF, MTTR, fração de janelas boas e número de episódios.

    MTTR = duração média do episódio (janelas ruins seguidas).
    MTBF = total de janelas boas / número de episódios.
    Sem episódio, os dois tempos ficam vazios.
    """
    if not ruins:
        return None, None, float("nan"), 0
    boas = sum(1 for ruim in ruins if not ruim)
    duracoes: list[int] = []
    correndo = 0
    for ruim in ruins:
        if ruim:
            correndo += 1
        elif correndo:
            duracoes.append(correndo)
            correndo = 0
    if correndo:
        duracoes.append(correndo)
    fracao = boas / len(ruins)
    if not duracoes:
        return None, None, fracao, 0
    mttr = sum(duracoes) / len(duracoes)
    mtbf = boas / len(duracoes)
    return mtbf, mttr, fracao, len(duracoes)


def weibull(unidades: list[Unidade]) -> dict:
    """MLE com censura à direita. Devolve a limitação quando a amostra não separa."""
    amostra = [u for u in unidades if not u.excluida and u.t > 0]
    falhas = [u for u in amostra if not u.censurada]
    if len(amostra) < 8 or not falhas or len(falhas) == len(amostra):
        return {
            "ajustou": False,
            "motivo": "amostra curta ou sem mistura de falha e censura",
            "n": len(amostra),
            "falhas": len(falhas),
        }

    t = np.array([u.t for u in amostra], dtype=float)
    cens = np.array([u.censurada for u in amostra], dtype=bool)

    def nll(theta: np.ndarray) -> float:
        beta, eta = theta
        if beta <= 1e-3 or eta <= 1e-3:
            return 1e12
        z = (t / eta) ** beta
        # Falha contribui com log da densidade; censura, com log da sobrevivência.
        ll = np.where(cens, -z, np.log(beta / eta) + (beta - 1) * np.log(t / eta) - z)
        if not np.isfinite(ll).all():
            return 1e12
        return float(-np.sum(ll))

    chute_eta = float(np.median(t))
    melhor = None
    for beta0 in (0.8, 1.0, 1.5):
        res = minimize(nll, np.array([beta0, chute_eta]), method="Nelder-Mead")
        if melhor is None or res.fun < melhor.fun:
            melhor = res
    if melhor is None or not melhor.success:
        return {"ajustou": False, "motivo": "a verossimilhança não convergiu", "n": len(amostra)}
    beta, eta = (float(x) for x in melhor.x)
    return {
        "ajustou": True,
        "beta": beta,
        "eta": eta,
        "n": len(amostra),
        "falhas": len(falhas),
        "censuras": len(amostra) - len(falhas),
        "R_no_eta": math.exp(-1),
    }


def relatorio(dominio: str, janelas: list[Janela], unidades: list[Unidade], relogio: str) -> dict:
    julgadas = [j for j in janelas if j.ruim is not None]
    mtbf, mttr, fracao, n_episodios = episodios([bool(j.ruim) for j in julgadas])
    vistas = [u for u in unidades if not u.excluida]
    return {
        "dominio": dominio,
        "relogio": relogio,
        "janelas_julgadas": len(julgadas),
        "fracao_dentro_do_objetivo": fracao,
        "mtbf": mtbf,
        "mttr": mttr,
        "episodios": n_episodios,
        "unidades": len(vistas),
        "falhou": sum(1 for u in vistas if not u.censurada),
        "fim_sem_estouro": sum(1 for u in vistas if u.censurada),
        "fora_da_amostra": sum(1 for u in unidades if u.excluida),
        "weibull": weibull(unidades),
        "unidades_lista": [asdict(u) for u in unidades],
    }
