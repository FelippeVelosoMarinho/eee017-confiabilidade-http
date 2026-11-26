#!/usr/bin/env python3
"""Gera o PowerPoint editável da apresentação da caixa fechada."""

from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

NAVY = RGBColor(0x1B, 0x3A, 0x4B)
INK = RGBColor(0x1C, 0x24, 0x28)
MUTED = RGBColor(0x5C, 0x6B, 0x73)
SAND = RGBColor(0xF6, 0xF3, 0xEC)
CREAM = RGBColor(0xFF, 0xFC, 0xF7)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CLAY = RGBColor(0xC4, 0x5C, 0x26)
GREEN = RGBColor(0x2F, 0x6F, 0x4E)
RED = RGBColor(0x9C, 0x2F, 0x2F)
GOLD = RGBColor(0xC4, 0x96, 0x2C)
LINE = RGBColor(0xD9, 0xD1, 0xC4)
CHIP = RGBColor(0x2C, 0x5F, 0x73)


def _set_run(run, text, size, color, bold=False, font="Calibri"):
    run.text = text
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.bold = bold
    run.font.name = font


def _fill(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def _line(shape, color, pt=1.25):
    shape.line.color.rgb = color
    shape.line.width = Pt(pt)


def add_bg(slide, color=CREAM):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    _fill(shape, color)
    # manda o fundo para trás
    sp_tree = slide.shapes._spTree
    sp = shape._element
    sp_tree.remove(sp)
    sp_tree.insert(2, sp)


def add_bar(slide):
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.12), SLIDE_H)
    _fill(bar, CLAY)


def tb(slide, l, t, w, h, text, size=18, color=INK, bold=False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    frame = box.text_frame
    frame.word_wrap = True
    frame.auto_size = None
    frame.margin_left = Emu(0)
    frame.margin_right = Emu(0)
    frame.margin_top = Emu(0)
    frame.margin_bottom = Emu(0)
    try:
        frame._txBody.bodyPr.set("anchor", {MSO_ANCHOR.TOP: "t", MSO_ANCHOR.MIDDLE: "ctr", MSO_ANCHOR.BOTTOM: "b"}[anchor])
    except Exception:
        pass
    p = frame.paragraphs[0]
    p.alignment = align
    _set_run(p.add_run() if p.runs else p.runs[0] if False else p.add_run(), text, size, color, bold)
    # o add_run acima sempre cria; limpa o run vazio inicial se existir duplicado
    return box


def paragraph(frame, text, size, color, bold=False, align=PP_ALIGN.LEFT, space_before=0, space_after=6, level=0):
    if frame.paragraphs[0].text == "" and len(frame.paragraphs) == 1 and not frame.paragraphs[0].runs:
        p = frame.paragraphs[0]
    else:
        p = frame.add_paragraph()
    p.alignment = align
    p.level = level
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    _set_run(p.add_run(), text, size, color, bold)
    return p


def block(slide, l, t, w, h, lines, size=18, color=INK, bold=False, align=PP_ALIGN.LEFT, spacing=8):
    box = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    frame = box.text_frame
    frame.word_wrap = True
    frame.margin_left = Emu(0)
    frame.margin_right = Emu(0)
    frame.margin_top = Emu(0)
    frame.margin_bottom = Emu(0)
    first = True
    for line in lines:
        if isinstance(line, tuple):
            text, kwargs = line
        else:
            text, kwargs = line, {}
        if first and frame.paragraphs[0].text == "" and not frame.paragraphs[0].runs:
            p = frame.paragraphs[0]
            first = False
        else:
            p = frame.add_paragraph()
        p.alignment = kwargs.get("align", align)
        p.space_before = Pt(kwargs.get("before", 0))
        p.space_after = Pt(kwargs.get("after", spacing))
        _set_run(
            p.add_run(),
            text,
            kwargs.get("size", size),
            kwargs.get("color", color),
            kwargs.get("bold", bold),
        )
    return box


def title(slide, text, subtitle=None):
    tb(slide, 0.55, 0.28, 12.2, 0.55, text, 32, NAVY, True)
    if subtitle:
        tb(slide, 0.55, 0.88, 12.2, 0.4, subtitle, 16, MUTED, False)


def footer(slide, page, total):
    tb(slide, 0.55, 7.12, 9.5, 0.28, "EEE 017  ·  caixa fechada  ·  funil e demonstração", 11, MUTED)
    tb(slide, 11.4, 7.12, 1.4, 0.28, f"{page}  /  {total}", 11, MUTED, align=PP_ALIGN.RIGHT)


def card(slide, l, t, w, h, fill=WHITE):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(h))
    _fill(shape, fill)
    _line(shape, LINE, 1)
    shape.adjustments[0] = 0.08
    return shape


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def arrow(slide, l, t, w, h):
    shape = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(l), Inches(t), Inches(w), Inches(h))
    _fill(shape, CLAY)
    return shape


def build():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    prs.core_properties.title = "Caixa fechada — funil e uma demonstração"
    prs.core_properties.subject = "EEE 017 Confiabilidade de Sistemas"
    blank = prs.slide_layouts[6]
    slides = []

    def new(bg=CREAM):
        slide = prs.slides.add_slide(blank)
        add_bg(slide, bg)
        add_bar(slide)
        slides.append(slide)
        return slide

    # 1 capa
    s = new(NAVY)
    tb(s, 0.7, 1.7, 11.5, 0.4, "EEE 017  ·  CONFIABILIDADE DE SISTEMAS", 16, RGBColor(0xE7, 0xC7, 0xB0), True)
    tb(s, 0.7, 2.2, 11.8, 1.6, "Uma caixa. Dois assuntos.\nA mesma conta.", 44, WHITE, True)
    tb(s, 0.7, 4.5, 10.5, 1.1, "Como um funil de vendas da Shark e a filmografia do Nicolas Cage\nentram no mesmo motor de confiabilidade.", 20, RGBColor(0xF6, 0xF3, 0xEC))
    tb(s, 0.7, 6.4, 10, 0.4, "UFMG  ·  2026", 14, RGBColor(0xE7, 0xC7, 0xB0))
    notes(s, "Abrir dizendo que o plugin não entende de marketing nem de cinema. Ele entende janela, estouro e tempo.")

    # 2 o que vamos contar
    s = new()
    title(s, "O que a caixa responde", "Três perguntas, para qualquer série que o adaptador consiga traduzir.")
    cards = [
        ("1", "A janela cumpriu\no combinado?", "A fração do tempo em que a série ficou dentro da regra."),
        ("2", "Quando a unidade\nfalha pela primeira vez?", "O tempo até o primeiro estouro, com os períodos ilesos preservados."),
        ("3", "A tolerância ainda\ncobre a carga?", "A barra da própria série contra o que o período apresentou."),
    ]
    for i, (n, head, body) in enumerate(cards):
        x = 0.55 + i * 4.15
        card(s, x, 2.0, 3.9, 4.2)
        tb(s, x + 0.3, 2.25, 3.3, 0.6, n, 28, CLAY, True)
        tb(s, x + 0.3, 3.05, 3.3, 1.4, head, 22, NAVY, True)
        tb(s, x + 0.3, 4.6, 3.3, 1.3, body, 16, INK)
    notes(s, "Não começar pelos números da Shark. Primeiro a pergunta. Os números vêm depois, como exemplo.")

    # 3 diagrama
    s = new()
    title(s, "A caixa, no desenho de um sistema", "Entradas, um chip que traduz, variáveis internas, saídas.")
    # entradas
    card(s, 0.45, 1.85, 2.35, 1.45, WHITE)
    tb(s, 0.6, 1.98, 2.05, 0.3, "ENTRADA", 11, CLAY, True)
    tb(s, 0.6, 2.3, 2.05, 0.8, "Série bruta\nCSV do funil", 16, NAVY, True)
    card(s, 0.45, 3.5, 2.35, 1.55, WHITE)
    tb(s, 0.6, 3.62, 2.05, 0.3, "ENTRADA", 11, CLAY, True)
    tb(s, 0.6, 3.95, 2.05, 0.9, "Regra\nP20, janela, histórico mínimo", 16, NAVY, True)
    arrow(s, 2.95, 2.95, 0.55, 0.32)
    # chip
    chip = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(3.6), Inches(2.35), Inches(2.35), Inches(2.15))
    _fill(chip, CHIP)
    chip.line.fill.background()
    tb(s, 3.75, 2.5, 2.05, 0.3, "CHIP DE ENTRADA", 11, RGBColor(0xE7, 0xC7, 0xB0), True)
    tb(s, 3.75, 2.9, 2.05, 1.3, "Adaptador\ntraduz a série para janela e unidade", 16, WHITE, True)
    arrow(s, 6.1, 2.95, 0.55, 0.32)
    # caixa
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(3.15), Inches(3.55))
    _fill(box, NAVY)
    box.line.fill.background()
    tb(s, 6.98, 1.95, 2.8, 0.35, "CAIXA FECHADA", 12, RGBColor(0xE7, 0xC7, 0xB0), True)
    tb(s, 6.98, 2.4, 2.8, 2.6, "Variáveis internas\n\njanelas boas e ruins\nunidades e o instante t\nepisódios\nβ e η da Weibull", 15, WHITE)
    arrow(s, 10.1, 2.95, 0.5, 0.32)
    card(s, 10.7, 1.85, 2.15, 3.45, WHITE)
    tb(s, 10.85, 2.0, 1.85, 0.3, "SAÍDAS", 11, CLAY, True)
    tb(s, 10.85, 2.45, 1.85, 2.6, "Fração dentro\ndo objetivo\n\nMTBF e MTTR\n\nEstado da unidade\ne curva R(t)", 15, NAVY, True)
    tb(s, 0.55, 5.7, 12.2, 1.1, "O chip muda quando o assunto muda. A caixa não. Funil ou cinema entram por adaptadores diferentes e saem nas mesmas quatro leituras.", 18, INK)
    notes(s, "Apontar o chip como a única peça que conhece o CSV. A caixa só vê janela ruim ou boa, e unidade com um tempo t.")

    # 4 três métricas em detalhe
    s = new()
    title(s, "As três métricas, em português claro")
    rows = [
        ("1  ·  Taxa na janela", "De cada bloco de tempo, quantos ficaram dentro da regra. É a disponibilidade. No funil, o bloco é o dia."),
        ("2  ·  Tempo até o primeiro estouro", "A unidade é acompanhada até a primeira janela ruim. Se o período acaba sem estouro, isso se registra. Não se inventa uma falha no fim do calendário."),
        ("3  ·  Carga e resistência", "A carga é o que o período apresentou. A resistência é a barra, tirada do passado da própria série. O período aguenta quando a barra ainda cobre a carga."),
    ]
    for i, (head, body) in enumerate(rows):
        y = 1.7 + i * 1.7
        card(s, 0.55, y, 12.2, 1.5)
        tb(s, 0.85, y + 0.18, 11.6, 0.4, head, 20, NAVY, True)
        tb(s, 0.85, y + 0.68, 11.6, 0.6, body, 16, INK)
    notes(s, "A terceira métrica, no funil, é exatamente a regra do P20: a resistência é a barra, a carga é o ROAS do dia. Quando o ROAS fica abaixo da barra, a carga venceu.")

    # 5 vocabulario janela e fração — foco shark
    s = new()
    title(s, "Janela e fração", "Primeiro no funil da Shark, que é o dado de verdade desta apresentação.")
    card(s, 0.55, 1.75, 6.0, 4.7)
    tb(s, 0.8, 1.95, 5.5, 0.4, "Janela", 22, NAVY, True)
    tb(s, 0.8, 2.55, 5.5, 3.5, "É o bloco em que a regra é aplicada uma vez.\n\nNo CSV da Shark cada linha já é um dia. Então a janela é o dia.\n\nUm dia sem clique e sem visita não vira janela. Ele não é sucesso e não é falha. Fica de fora.", 17, INK)
    card(s, 6.8, 1.75, 6.0, 4.7)
    tb(s, 7.05, 1.95, 5.5, 0.4, "Fração dentro do objetivo", 22, NAVY, True)
    tb(s, 7.05, 2.55, 5.5, 3.5, "Das janelas que deu para julgar, quantas não estouraram.\n\nNa Shark foram 66 dias julgados. 48 ficaram acima da barra.\n\n48 / 66  =  72,7%.\n\nEsse é o tempo em que o retorno do dia ainda era compatível com o habitual recente.", 17, INK)
    notes(s, "92 dias no arquivo, 12 sem tráfego, 14 só para construir a barra. Conta em voz: 80 com tráfego, menos 14 de aquecimento, 66 julgados.")

    # 6 unidade, t, censura, fora
    s = new()
    title(s, "A unidade e os três destinos", "A janela julga o dia. A unidade conta a história da semana.")
    items = [
        (GREEN, "Fim sem estouro", "A semana foi vista até o domingo e nenhum dia furou a barra. Isso é censura: até aqui, não falhou. As semanas 40 e 41 foram assim."),
        (RED, "Falhou em t", "t é o dia da semana do primeiro estouro. 1 é segunda, 2 é terça. Em 8 das 9 semanas que falharam, t = 2. A vida daquela semana, para a curva, acaba na terça."),
        (MUTED, "Fora da amostra", "Ainda não havia barra. As semanas 31, 32 e 33 só alimentaram os 14 dias de referência. Não entram como semana boa."),
    ]
    for i, (color, head, body) in enumerate(items):
        y = 1.7 + i * 1.7
        mark = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.6), Inches(y + 0.35), Inches(0.28), Inches(0.28))
        _fill(mark, color)
        tb(s, 1.15, y, 11.4, 0.4, head, 20, NAVY, True)
        tb(s, 1.15, y + 0.45, 11.4, 1.0, body, 16, INK)
    notes(s, "Insistir: censura não é dia vazio. Dia vazio é fora da amostra. Censura é ter olhado e não ter visto o estouro.")

    # 7 episodio mtbf mttr
    s = new()
    title(s, "Episódio, MTBF e MTTR", "A média de dias ruins esconde se o problema passa ou se fica.")
    card(s, 0.55, 1.7, 12.2, 1.55)
    tb(s, 0.8, 1.85, 11.7, 1.25, "Episódio é uma sequência de dias ruins colados. Na Shark foram 13 sequências: nove de um dia, três de dois dias e uma de três dias. O retorno costuma voltar no dia seguinte.", 18, INK)
    card(s, 0.55, 3.5, 6.0, 2.9)
    tb(s, 0.8, 3.7, 5.5, 0.4, "MTTR  ·  1,4 dia", 22, NAVY, True)
    tb(s, 0.8, 4.3, 5.5, 1.8, "Duração média do episódio. Quanto tempo o funil fica abaixo da barra depois que sai. Aqui, pouco mais de um dia.", 17, INK)
    card(s, 6.8, 3.5, 6.0, 2.9)
    tb(s, 7.05, 3.7, 5.5, 0.4, "MTBF  ·  3,7 dias", 22, NAVY, True)
    tb(s, 7.05, 4.3, 5.5, 1.8, "Total de dias bons dividido pelo número de episódios. Cada sequência ruim veio com cerca de 3,7 dias bons ao redor.", 17, INK)
    notes(s, "Mostrar a conta de conferência: 3,7 / (3,7 + 1,4) dá os 73%. Os dois tempos e a fração são a mesma história.")

    # 8 a shark em uma frase
    s = new()
    title(s, "A Shark, com a regra declarada antes")
    card(s, 0.55, 1.75, 12.2, 4.6, NAVY)
    tb(s, 0.9, 2.05, 11.5, 0.4, "O QUE FOI COMBINADO", 14, RGBColor(0xE7, 0xC7, 0xB0), True)
    tb(s, 0.9, 2.6, 11.5, 3.3, "O dia estoura quando o ROAS fica abaixo do percentil 20 dos dias com tráfego que já passaram.\n\nA barra anda. Ela não usa o próprio dia, e não usa o futuro.\n\nDe agosto a outubro de 2026, o funil ficou dentro dessa barra em 72,7% dos dias julgados. Quando saiu, a saída durou em média 1,4 dia e voltou a se repetir a cada 3,7 dias bons.", 22, WHITE)
    notes(s, "Não ler ROAS de dia específico. A história é a barra móvel e a terça-feira como primeiro estouro da semana.")

    # 9 quadro das semanas
    s = new()
    title(s, "O quadro das semanas da Shark", "Cada quadrado é uma semana. A cor é o destino da unidade.")
    labels = [
        ("31", "fora", MUTED),
        ("32", "fora", MUTED),
        ("33", "fora", MUTED),
        ("34", "terça", RED),
        ("35", "terça", RED),
        ("36", "terça", RED),
        ("37", "terça", RED),
        ("38", "terça", RED),
        ("39", "terça", RED),
        ("40", "ilessa", GREEN),
        ("41", "ilessa", GREEN),
        ("42", "terça", RED),
        ("43", "terça", RED),
        ("44", "quarta", RED),
    ]
    for i, (week, tag, color) in enumerate(labels):
        x = 0.5 + (i % 7) * 1.82
        y = 1.85 + (i // 7) * 2.15
        shape = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(1.65), Inches(1.9))
        _fill(shape, color)
        shape.line.fill.background()
        tb(s, x + 0.1, y + 0.25, 1.45, 0.4, f"sem. {week}", 14, WHITE, True, PP_ALIGN.CENTER)
        tb(s, x + 0.1, y + 0.85, 1.45, 0.7, tag, 18, WHITE, True, PP_ALIGN.CENTER)
    notes(s, "Semanas 31 a 33: aquecimento. 34 a 39: primeira falha na terça. 40 e 41: as duas semanas ilesas. 42 e 43 de novo na terça. 44 na quarta.")

    # 10 leitura da terça e da weibull
    s = new()
    title(s, "O que a curva acrescenta à fração")
    card(s, 0.55, 1.75, 6.0, 4.7)
    tb(s, 0.8, 1.95, 5.5, 0.45, "β  ≈  1,46", 28, NAVY, True)
    tb(s, 0.8, 2.7, 5.5, 3.3, "Maior que 1: o risco do primeiro estouro cresce ao longo da semana.\n\nA segunda quase não é o dia da falha. A terça é. A semana que passa da terça tem mais chance de chegar ao domingo, como nas semanas 40 e 41.\n\nη ≈ 3,7 dias da semana. Por volta da quarta, boa parte das semanas já furou a barra uma vez.", 17, INK)
    card(s, 6.8, 1.75, 6.0, 4.7)
    tb(s, 7.05, 1.95, 5.5, 0.45, "O cuidado", 28, NAVY, True)
    tb(s, 7.05, 2.7, 5.5, 3.3, "São 11 semanas. Nove falharam, duas chegaram ilesas.\n\nDá para ver o desenho. É pouco para tratar β como uma lei estável do funil.\n\nA leitura que se sustenta com essa amostra é a outra: 73% dos dias dentro da barra, episódios curtos, primeiro estouro na terça.", 17, INK)
    notes(s, "Se perguntarem se a terça é causa: a regra marcou a terça. A causa comercial fica para quem opera o funil. A caixa só localizou o instante.")

    # 11 ponte para a piada
    s = new(NAVY)
    tb(s, 0.7, 2.0, 12, 0.4, "A MESMA CAIXA, OUTRO ASSUNTO", 14, RGBColor(0xE7, 0xC7, 0xB0), True)
    tb(s, 0.7, 2.6, 12, 2.2, "E se a entrada não for um funil?", 40, WHITE, True)
    tb(s, 0.7, 4.6, 11.5, 1.4, "O chip troca. A caixa não conhece o assunto. A conta, ela faz com a mesma seriedade.\nA demonstração é uma homenagem às correlações espúrias.", 22, RGBColor(0xF6, 0xF3, 0xEC))
    notes(s, "Pausa. Avisar que o que vem é brincadeira com dado público, para mostrar a universalização. O dado de negócio foi o da Shark.")

    # 12 regra do cage
    s = new()
    title(s, "Nicolas Cage e os acidentes aéreos", "Adaptador cage.aviacao. Janela de um mês. Unidade de um ano.")
    steps = [
        ("1", "A série", "Estreias de filmes, em fonte pública, cruzadas com a contagem mensal de acidentes aéreos catalogados no Wikidata."),
        ("2", "A regra", "O mês estoura só se as duas coisas acontecem: estreia de um filme dele e acidentes acima da média dos meses anteriores."),
        ("3", "O limite", "Não é o censo oficial de aviação. Mês sem registro entra como zero. A média fica mais baixa do que a de um anuário."),
    ]
    for i, (n, head, body) in enumerate(steps):
        x = 0.55 + i * 4.15
        card(s, x, 1.9, 3.9, 4.4)
        tb(s, x + 0.25, 2.15, 3.4, 0.5, n, 28, CLAY, True)
        tb(s, x + 0.25, 2.85, 3.4, 0.6, head, 22, NAVY, True)
        tb(s, x + 0.25, 3.6, 3.4, 2.2, body, 16, INK)
    notes(s, "Dizer o limite da fonte antes da piada. Wikidata não é NTSB. A piada sobrevive a essa ressalva.")

    # 13 números do cage ao lado
    s = new()
    title(s, "Os mesmos nomes, outro relógio")
    headers = ["", "Shark", "Cage"]
    body = [
        ("Janela", "1 dia", "1 mês"),
        ("Unidade", "1 semana", "1 ano"),
        ("Dentro do objetivo", "72,7% dos dias", "93% dos meses"),
        ("MTBF", "3,7 dias bons", "13,7 meses bons"),
        ("MTTR", "1,4 dia", "1,0 mês"),
        ("Primeiro estouro", "terça, em 8 de 9 semanas", "janeiro, em 17 de 27 anos"),
        ("Fim sem estouro", "2 semanas", "16 anos"),
        ("β da Weibull", "1,46  ·  risco cresce na semana", "0,70  ·  risco cai ao longo do ano"),
    ]
    card(s, 0.55, 1.65, 12.2, 5.15, WHITE)
    xs = [0.8, 4.5, 8.5]
    for x, head in zip(xs, headers):
        tb(s, x, 1.8, 3.6, 0.4, head, 18, CLAY, True)
    for i, row in enumerate(body):
        y = 2.35 + i * 0.52
        for x, text, bold in zip(xs, row, (True, False, False)):
            tb(s, x, y, 3.8, 0.45, text, 16, NAVY if bold else INK, bold)
    notes(s, "Ler uma linha, não a tabela inteira. A linha do primeiro estouro é a que a plateia lembra: terça e janeiro.")

    # 14 alusão
    s = new()
    title(s, "A alusão")
    card(s, 0.55, 1.75, 6.0, 4.6)
    tb(s, 0.85, 2.0, 5.4, 0.4, "A Shark", 14, CLAY, True)
    tb(s, 0.85, 2.55, 5.4, 3.4, "Sai do objetivo com frequência e volta rápido.\n\nO calendário perigoso cabe num dia da semana.\n\nA caixa não sabe o que é anúncio. Ela sabe que a terça é o primeiro furo.", 20, NAVY)
    card(s, 6.8, 1.75, 6.0, 4.6)
    tb(s, 7.1, 2.0, 5.4, 0.4, "O Cage", 14, CLAY, True)
    tb(s, 7.1, 2.55, 5.4, 3.4, "Passa quase todos os meses dentro da regra.\n\nQuando o ano fura, fura cedo, muitas vezes em janeiro, e o mês seguinte já não repete.\n\nA caixa também não sabe o que é filme.", 20, NAVY)
    notes(s, "A piada é a simetria. Não esticar. Uma frase de cada lado e ir para o fechamento.")

    # 15 piada final
    s = new(NAVY)
    tb(s, 0.75, 1.5, 11.8, 1.2, "O conselho da caixa", 18, RGBColor(0xE7, 0xC7, 0xB0), True)
    tb(s, 0.75, 2.2, 11.8, 2.4, "Cuide da terça-feira.\nEvite estrear em janeiro.", 36, WHITE, True)
    tb(s, 0.75, 5.1, 11.5, 1.3, "Só o primeiro conselho deve sair desta sala.\nO segundo é o que acontece quando o adaptador traduz qualquer coisa e a caixa obedece com a mesma seriedade.", 18, RGBColor(0xF6, 0xF3, 0xEC))
    notes(s, "Encerrar aqui. Se sobrar pergunta de método, voltar ao chip de entrada: a piada só funciona porque o dado foi traduzido para o mesmo registro.")

    # 16 o que fica
    s = new()
    title(s, "O que a demonstração segura")
    points = [
        "O motor não precisa conhecer o negócio. Precisa de janela, de regra e de unidade.",
        "Na Shark, a regra foi o retorno do dia contra o P20 do passado. O resultado é uma disponibilidade de 73%, episódios curtos e um primeiro estouro na terça.",
        "No Cage, a mesma conta produz uma disponibilidade de 93% e um primeiro estouro em janeiro. A fonte é pública e incompleta, e o resultado é uma piada com fórmula de verdade.",
        "Trocar de assunto, daqui para a frente, é escrever outro adaptador.",
    ]
    for i, text in enumerate(points):
        y = 1.7 + i * 1.25
        tb(s, 0.55, y, 0.5, 0.4, f"{i + 1}", 22, CLAY, True)
        tb(s, 1.15, y, 11.4, 1.05, text, 18, INK)
    notes(s, "Não abrir Grafana nesta fala. Se perguntarem como isso vira painel, dizer que o relatório já sai em JSON e o painel é o passo seguinte.")

    total = len(slides)
    # capa e slides escuros de transição não levam o rodapé claro por cima do navy da mesma forma
    dark = {0, 10, 14}
    for i, slide in enumerate(slides, start=1):
        if i - 1 in dark:
            tb(slide, 11.3, 6.95, 1.5, 0.3, f"{i}  /  {total}", 12, RGBColor(0xE7, 0xC7, 0xB0), align=PP_ALIGN.RIGHT)
        else:
            footer(slide, i, total)

    out = Path(__file__).resolve().parent / "caixa-fechada.pptx"
    prs.save(out)
    print(out, "slides", total)


if __name__ == "__main__":
    build()
