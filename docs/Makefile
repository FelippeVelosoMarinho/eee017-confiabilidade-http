LATEX     = pdflatex
BIBTEX    = bibtex
LATEXOPTS = -interaction=nonstopmode -halt-on-error

PROPOSAL_DIR = proposal
REPORT_DIR   = report

.PHONY: all proposal report clean distclean

all: proposal report

proposal:
	cd $(PROPOSAL_DIR) && \
	$(LATEX) $(LATEXOPTS) proposal.tex && \
	$(BIBTEX) proposal && \
	$(LATEX) $(LATEXOPTS) proposal.tex && \
	$(LATEX) $(LATEXOPTS) proposal.tex

report:
	cd $(REPORT_DIR) && \
	$(LATEX) $(LATEXOPTS) report.tex && \
	$(BIBTEX) report && \
	$(LATEX) $(LATEXOPTS) report.tex && \
	$(LATEX) $(LATEXOPTS) report.tex

clean:
	cd $(PROPOSAL_DIR) && rm -f *.aux *.log *.bbl *.blg *.out *.toc *.lof *.lot *.fls *.fdb_latexmk *.synctex.gz
	cd $(REPORT_DIR)   && rm -f *.aux *.log *.bbl *.blg *.out *.toc *.lof *.lot *.fls *.fdb_latexmk *.synctex.gz

distclean: clean
	cd $(PROPOSAL_DIR) && rm -f proposal.pdf
	cd $(REPORT_DIR)   && rm -f report.pdf
