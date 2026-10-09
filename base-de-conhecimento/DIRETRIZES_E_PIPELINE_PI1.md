# Diretrizes Metodológicas e Pipeline de Produção — PI-1 (2026/2)
**Unidade Curricular:** Projeto Integrador 1 (PI-1)  
**Curso:** Técnico Integrado em Informática ao Ensino Médio — Turma Info 25 (2º Ano / 40h)  
**Docentes Responsáveis:** Prof. André Moraes & Profª. Josimara Martins Krausen  
**Instituição:** Instituto Federal de Santa Catarina (IFSC) — Câmpus Garopaba  

---

## 1. Visão Geral e Fundamentação Pedagógica

Diferente de abordagens tradicionais baseadas em documentação burocrática e estática (que consomem tempo dos estudantes e acabam abandonadas), o **Projeto Integrador 1 (Info 25)** adota a ótica do **Aprendizado Experimental** apoiado por **Artefatos Vivos (Living Artifacts)**.

### Objetivos-Chave:
1. **Eliminar Burocracia Descartável:** O tempo da aula é focado em planejar, modelar visualmente, prototipar e coletar dados empíricos.
2. **Artefatos Vivos de Consulta Contínua:** Todo diagrama, wireframe ou quadro kanban deve ser uma ferramenta de consulta ativa do grupo durante todo o desenvolvimento.
3. **Pipeline de Produção Integrado:** Cada etapa metodológica gera o insumo direto para a etapa seguinte, culminando no Artigo Científico (Padrão SBC/IFSC) e na submissão ao evento institucional (ex: SEPE).

```
   +-----------------------+      +-----------------------+      +-----------------------+
   | 1. Problema Real &    | ---> | 2. Diagramas Vivos    | ---> | 3. Protótipo Mínimo & |
   |    Hipótese Científica|      |    (draw.io / Wirefr.)|      |    Código no GitHub   |
   +-----------------------+      +-----------------------+      +-----------------------+
                                                                             |
                                                                             v
   +-----------------------+      +-----------------------+      +-----------------------+
   | 6. Submissão a Evento | <--- | 5. Artigo Científico  | <--- | 4. Coleta de Dados    |
   |    (SEPE / Simpósio)  |      |    (Padrão SBC/IFSC)  |      |    & Testes Empíricos |
   +-----------------------+      +-----------------------+      +-----------------------+
```

---

## 2. Padrão de Modelagem Visual: draw.io (diagrams.net)

Adota-se o **draw.io** como a ferramenta oficial e padronizada de modelagem da disciplina, devido à sua facilidade de uso (drag-and-drop), integração com Google Drive/GitHub e suporte a formatos de exportação vivos.

### Os 3 Diagramas Essenciais dos Grupos:

1. **Diagrama de Arquitetura / Fluxo do Sistema (System Blueprint):**
   - Mapeia o fluxo de ponta a ponta: *Entrada de Dados/Sensores $\to$ Processamento/Lógica $\to$ Saída/Interface*.
   - **Regra:** O grupo deve consultar este diagrama toda vez que for implementar um novo módulo ou função.
2. **Wireframe / Mapa de Telas (User Experience):**
   - Esboço do layout das telas e navegação antes da codificação HTML/CSS/JS para evitar retrabalho.
3. **Matriz de Hipóteses & Experimentos:**
   - Registro claro do que está sendo testado, qual métrica será coletada e qual o critério de sucesso.

> **Dica de Formato:** Os grupos salvarão seus diagramas no formato `.drawio.png` ou `.svg` dentro do repositório (`docs/arquitetura.drawio.png`). Assim, o diagrama é renderizado automaticamente no Markdown do GitHub e pode ser reaberto no draw.io com duplo clique para edição.

---

## 3. Estrutura Padrão dos Repositórios dos Grupos

Cada equipe manterá um repositório GitHub organizado segundo o padrão da UC:

```text
projeto-info25-grupo-XX/
├── README.md               # Hub público: Título, Equipe, Resumo, Diagrama draw.io e Links
├── docs/                   # Diagramas e documentação viva
│   ├── arquitetura.drawio  # Arquivo editável no draw.io
│   ├── arquitetura.png     # Imagem exportada para visualização
│   └── wireframes/         # Esboços de interface
├── src/                    # Código-fonte da aplicação / scripts / simulações
├── experimentos/           # Planilhas de dados empíricos coletados e gráficos
└── artigo/                 # Artigo científico formatado (LaTeX / SBC Template)
```

---

## 4. Estrutura da Planilha de Acompanhamento (Google Sheets)

A planilha dos docentes funcionará como a **Fonte Única da Verdade (SSOT)**, alimentando dinamicamente o Dashboard Web da turma.

### Colunas Padronizadas:

| Coluna | Identificador Técnico | Descrição |
| :--- | :--- | :--- |
| **A** | `id_grupo` | Código da equipe (ex: `G01`, `G02`, ...) |
| **B** | `integrantes` | Nomes dos alunos da equipe |
| **C** | `titulo_projeto` | Nome ou proposta provisória do projeto |
| **D** | `eixo_interdisciplinar` | Ex: *Inf + Meio Ambiente*, *Inf + Estruturas*, *Inf + Física*, *Inf + Cidades Inteligentes* |
| **E** | `problema_hipotese` | Síntese do problema e hipótese a ser testada experimentalmente |
| **F** | `link_github` | URL do repositório no GitHub |
| **G** | `link_pages` | URL da página web pública no GitHub Pages |
| **H** | `link_drawio` | URL de visualização do diagrama no draw.io |
| **I** | `status_cp1` | Status do Checkpoint 1 (*A Fazer* / *Em Andamento* / *Entregue* / *Revisar*) |
| **J** | `status_cp2` | Status do Checkpoint 2 (*A Fazer* / *Em Andamento* / *Entregue* / *Revisar*) |
| **K** | `status_cp3` | Status do Checkpoint 3 (*A Fazer* / *Em Andamento* / *Entregue* / *Revisar*) |
| **L** | `artigo_submissao` | Status da submissão ao evento institucional (*Pendente* / *Submetido* / *Aprovado*) |
| **M** | `feedback_docentes` | Parecer pedagógico e pontos de atenção para as mentorias |

---

## 5. Marcos Avaliativos e Checkpoints

O semestre é estruturado em **3 Checkpoints Práticos**, distribuídos ao longo dos 20 encontros (40h):

* **Checkpoint 1 (Semana 7 / Encontros 13-14):** Protótipo Mínimo Funcional + Diagrama de Arquitetura no draw.io + Coleta inicial de dados.
* **Checkpoint 2 (Semana 8 / Encontros 15-16):** Tabulação completa dos dados empíricos + Primeira versão do Artigo Científico (Introdução, Metodologia e Resultados).
* **Checkpoint 3 (Semana 9 / Encontros 17-18):** Artigo revisado e formatado nas normas da SBC/IFSC + Pacote pronto para submissão ao SEPE/Simpósio.
* **Apresentação Final (Encontro 19):** Defesa oral demonstrativa e banca pedagógica.
