# Directives & Rules for Projeto Integrador 1 (Técnico Integrado em Informática - Turma Info 25)

1. **Alignment with PPC:**
   - Always align course materials with the official PPC syllabus for Técnico Integrado em Informática (Ano 2 / 40h).
   - Target Audience: High school technical informatics students (Turma Info 25).

2. **The 4 Pedagogical Pillars:**
   - Pillar 1: Project Management Fundamentals & Scientific Method.
   - Pillar 2: Visual Modeling & Planning Tools (WBS, Gantt, Kanban, Wireframes, draw.io).
   - Pillar 3: Code Control & Versioning (Git, GitHub, GitHub Pages).
   - Pillar 4: Production Checkpoints & Scientific Paper (SBC/IFSC Format) + Event Submission.

3. **Modeling & Diagrams:**
   - Official tool: **draw.io** (diagrams.net). Formats: `.drawio.png` / `.svg` in `docs/arquitetura.drawio.png`.
   - Experimental learning approach: Living artifacts that are actively referenced throughout development.

4. **Knowledge Base:**
   - Consult and update guidelines in `base-de-conhecimento/` as the single source of truth for pedagogical design, templates, and dashboard data schemas.

5. **LaTeX Compilation:**
   - Use `tectonic` for compiling `.tex` syllabus documents (`plano_de_ensino.tex`).

6. **Permanência e Intocabilidade do Painel Central de Notas & Avaliações:**
   - O **Painel Central de Notas & Avaliações** (aba `tab-notas`, botão de navegação `Notas & Avaliações` na `tabs-nav`, botão `#pi1-btn-notas-top` no cabeçalho e atalho dentro do `Painel Docente`) é uma funcionalidade nuclear e **permanente**.
   - É terminantemente proibido remover, omitir ou desvincular o painel de notas em futuras refatorações de `2026-2/index.html`, `2026-2/pi1-live.js` ou scripts de automação.
   - As chamadas `renderNotasTab()`, `filtrarTabelaNotas()` e a exportação em `window.PI1` devem ser preservadas em todos os ciclos de renderização e sincronização.

