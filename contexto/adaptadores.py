"""Dois adaptadores, o mesmo registro de janela e de unidade.

funil.vendas lê o CSV diário que já existe (não vai para o Git).
cage.aviacao lê a filmografia pública e a contagem mensal de acidentes
catalogados no Wikidata. Não é o censo da NTSB. O arquivo pode ser trocado
por outro com as mesmas colunas.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from motor import Janela, Unidade, percentil_anterior

FUNIL_MIN_HISTORIA = 14
FUNIL_P_ROAS = 20
CAGE_MIN_MESES = 12


def _numero_br(texto: str) -> float:
    limpo = (texto or "").strip().replace("R$", "").replace("%", "").replace(" ", "")
    if not limpo:
        return 0.0
    if "," in limpo:
        limpo = limpo.replace(".", "").replace(",", ".")
    return float(limpo)


def _data_br(texto: str) -> datetime:
    return datetime.strptime(texto.strip(), "%d/%m/%Y")


def funil_vendas(caminho: Path) -> tuple[list[Janela], list[Unidade]]:
    """Janela = dia com tráfego. Unidade = semana ISO.

    Estouro do dia: ROAS abaixo do P20 dos dias elegíveis anteriores.
    Os primeiros 14 dias elegíveis só formam essa referência.
    Dia sem clique e sem visita fica fora da amostra.
    Semana sem nenhum dia julgado também fica fora.
    Semana julgada sem dia ruim: fim sem estouro, t = último dia visto (1–7).
    """
    with caminho.open(newline="", encoding="utf-8-sig") as handle:
        linhas = list(csv.DictReader(handle))

    dias = []
    for linha in linhas:
        rotulo = (linha.get("Data") or "").strip()
        if not rotulo or "Total" in rotulo:
            continue
        quando = _data_br(rotulo)
        cliques = _numero_br(linha["Cliques no link"])
        visitas = _numero_br(linha["Visualizações da página de destino"])
        roas = _numero_br(linha["ROAS"])
        dias.append((quando, cliques, visitas, roas))
    dias.sort(key=lambda item: item[0])

    elegiveis = [(q, roas) for q, cliques, visitas, roas in dias if cliques > 0 or visitas > 0]
    roas_serie = [roas for _, roas in elegiveis]

    janelas: list[Janela] = []
    por_semana: dict[tuple[int, int], list[tuple[datetime, bool | None]]] = defaultdict(list)
    for ordem, (quando, roas) in enumerate(elegiveis):
        limite = percentil_anterior(roas_serie, ordem, FUNIL_P_ROAS, FUNIL_MIN_HISTORIA)
        ruim = None if limite is None else roas < limite
        janelas.append(Janela(id=quando.date().isoformat(), ordem=ordem, valor=roas, elegivel=True, ruim=ruim))
        iso = quando.isocalendar()
        por_semana[(iso.year, iso.week)].append((quando, ruim))

    unidades: list[Unidade] = []
    for chave in sorted(por_semana):
        eventos = por_semana[chave]
        julgados = [(quando, ruim) for quando, ruim in eventos if ruim is not None]
        ident = f"{chave[0]}-W{chave[1]:02d}"
        if not julgados:
            unidades.append(Unidade(ident, t=0, censurada=False, excluida=True))
            continue
        ruins = [(quando, ruim) for quando, ruim in julgados if ruim]
        if ruins:
            # Dia da semana da primeira janela ruim: 1 = segunda … 7 = domingo.
            t = float(ruins[0][0].isoweekday())
            unidades.append(Unidade(ident, t=t, censurada=False, excluida=False))
        else:
            t = float(julgados[-1][0].isoweekday())
            unidades.append(Unidade(ident, t=t, censurada=True, excluida=False))
    return janelas, unidades


def _premiere_por_mes(caminho: Path) -> dict[tuple[int, int], int]:
    contagem: dict[tuple[int, int], int] = defaultdict(int)
    with caminho.open(newline="", encoding="utf-8") as handle:
        for linha in csv.DictReader(handle):
            ano, mes, _dia = linha["estreia"].split("-")
            contagem[(int(ano), int(mes))] += 1
    return contagem


def _incidentes_por_mes(caminho: Path) -> dict[tuple[int, int], int]:
    serie = {}
    with caminho.open(newline="", encoding="utf-8") as handle:
        for linha in csv.DictReader(handle):
            serie[(int(linha["ano"]), int(linha["mes"]))] = int(linha["n"])
    return serie


def cage_aviacao(filmes: Path, incidentes: Path) -> tuple[list[Janela], list[Unidade]]:
    """Janela = mês. Unidade = ano.

    Estouro: estreia de filme naquele mês e acidentes acima da média dos meses
    anteriores. Os 12 primeiros meses da série só formam essa média.
    Ano sem nenhum mês julgado fica fora. Ano julgado até dezembro sem estouro
    censura em t = 12.
    """
    estreias = _premiere_por_mes(filmes)
    bruto = _incidentes_por_mes(incidentes)
    if not bruto:
        return [], []
    inicio = min(bruto)
    fim = max(bruto)
    grade: list[tuple[int, int]] = []
    ano, mes = inicio
    while (ano, mes) <= fim:
        grade.append((ano, mes))
        mes += 1
        if mes == 13:
            ano, mes = ano + 1, 1

    contagens = [bruto.get(chave, 0) for chave in grade]
    janelas: list[Janela] = []
    por_ano: dict[int, list[tuple[int, bool | None]]] = defaultdict(list)
    for ordem, chave in enumerate(grade):
        media = None
        if ordem >= CAGE_MIN_MESES:
            media = sum(contagens[:ordem]) / ordem
        estreou = estreias.get(chave, 0) > 0
        ruim = None if media is None else estreou and contagens[ordem] > media
        janelas.append(
            Janela(
                id=f"{chave[0]:04d}-{chave[1]:02d}",
                ordem=ordem,
                valor=float(contagens[ordem]),
                elegivel=media is not None,
                ruim=ruim,
            )
        )
        por_ano[chave[0]].append((chave[1], ruim))

    unidades: list[Unidade] = []
    for ano in sorted(por_ano):
        julgados = [(mes, ruim) for mes, ruim in por_ano[ano] if ruim is not None]
        if not julgados:
            unidades.append(Unidade(str(ano), t=0, censurada=False, excluida=True))
            continue
        ruins = [mes for mes, ruim in julgados if ruim]
        if ruins:
            unidades.append(Unidade(str(ano), t=float(ruins[0]), censurada=False, excluida=False))
        else:
            unidades.append(Unidade(str(ano), t=float(julgados[-1][0]), censurada=True, excluida=False))
    return janelas, unidades
