# Roteiro Prático de Aula #2 — Projeto Integrador I
**IFSC Câmpus Garopaba • Técnico Integrado em Informática (Turma Info 2025 • 2º Ano / 2026-2)**  
**Docente Responsável:** Prof. Dr. André Moraes (`andre.moraes@ifsc.edu.br`)  
**Tema da Aula:** Pesquisa Bibliográfica, Fichamento e Trabalhos Relacionados (COTB / Portal de Periódicos da UNIVALI)

---

## 🎯 1. Objetivos da Aula de Hoje

Ao final desta aula prática, cada equipe deverá ter concluído:
1. Compreender o papel da seção de **Trabalhos Relacionados** em um artigo científico de software (provar relevância, evitar "reinventar a roda" e evidenciar o diferencial técnico da equipe);
2. Pesquisar e selecionar **pelo menos 2 artigos científicos correlatos** nos anais do *Computer on the Beach (Portal de Periódicos da UNIVALI)* ou *Google Acadêmico*;
3. Aplicar o **Tripé de Análise Crítica** em cada trabalho selecionado (*O que fizeram? Como fizeram? Qual a limitação deles ou diferencial do seu software?*);
4. Redigir os parágrafos de síntese na **Seção 2 (Trabalhos Relacionados)** do template SBC no Overleaf utilizando a fórmula de redação científica;
5. Importar as entradas BibTeX para o arquivo `references.bib` do Overleaf e citá-las no texto com o comando `\cite{...}`;
6. Registrar as referências e a análise comparativa no **Dashboard Oficial de PI-1**.

---

## 🔗 Links Úteis para a Aula

* 📖 **Guia e Roteiro Prático Interativo #2:**  
  [https://chameoandre.github.io/UC-Projeto-Integrador-1-TEC-INF/2026-2/roteiro-2-trabalhos-relacionados-cotb/](https://chameoandre.github.io/UC-Projeto-Integrador-1-TEC-INF/2026-2/roteiro-2-trabalhos-relacionados-cotb/)
* 📊 **Dashboard Oficial de Projetos PI-1:**  
  [https://chameoandre.github.io/UC-Projeto-Integrador-1-TEC-INF/2026-2/](https://chameoandre.github.io/UC-Projeto-Integrador-1-TEC-INF/2026-2/)
* 📚 **Anais do Computer on the Beach (Portal de Periódicos da UNIVALI):**  
  [https://periodicos.univali.br/index.php/cotb](https://periodicos.univali.br/index.php/cotb)
* 🔍 **Google Acadêmico:**  
  [https://scholar.google.com.br](https://scholar.google.com.br)
* 📄 **Template de Artigos SBC no Overleaf:**  
  [https://www.overleaf.com/latex/templates/sbc-conferences-articles-template/bzkpfsxspfhs](https://www.overleaf.com/latex/templates/sbc-conferences-articles-template/bzkpfsxspfhs)

---

## 📋 As 5 Regrinhas Básicas para Trabalhos Relacionados

### Regra 1: Onde e Como Garimpar Artigos Válidos

* **O que É um Trabalho Relacionado:** Um artigo científico publicado em congresso, conferência (ex.: *Computer on the Beach - COTB, WEI, SBIE, SEPEI*) ou periódico indexado que resolveu um problema similar ou usou tecnologias análogas às do seu projeto.
* **O que NÃO é Trabalho Relacionado:** Postagens de blogs genéricos, tutoriais do YouTube, fóruns de dúvidas ou documentações oficiais de ferramentas (ex: "Documentação do Bootstrap" não é artigo científico).
* **Estratégia de Busca Inteligente:**
  - Na **Portal de Periódicos da UNIVALI (COTB)**, use termos-chave do seu nicho: `"gamificação"`, `"acessibilidade"`, `"ensino de programação"`, `"aplicação web"`, `"gestão escolar"`.
  - No **Google Acadêmico**, use operadores combinados: `"Computer on the Beach" AND "palavra-chave"`.
  - Priorize publicações dos últimos **3 a 5 anos** para garantir atualidade.

---

### Regra 2: O Tripé de Análise Crítica

Ao ler o artigo selecionado (principalmente o *Resumo*, a *Introdução* e a *Conclusão*), cada equipe deve extrair 3 respostas objetivas:

1. **O que eles fizeram?**  
   *Qual foi a proposta central dos autores? Qual software, aplicativo ou experimento eles criaram?*
2. **Como eles fizeram?**  
   *Quais tecnologias, arquiteturas, frameworks, métodos ou linguagens foram empregadas?*
3. **Qual é a limitação deles ou o diferencial do seu projeto?**  
   *O que o trabalho deles deixou de fora ou atendeu apenas parcialmente? O que o SEU software fará de diferente, mais acessível, mais rápido, com interface web responsiva ou adaptado à comunidade local?*

---

### Regra 3: A Fórmula do Parágrafo Científico (Template Pronto)

Nunca copie e cole o resumo do autor. Utilize a fórmula padrão da escrita acadêmica em computação para redigir o parágrafo no seu artigo:

$$\text{[Abertura e Citação]} + \text{[Proposta e Objetivo]} + \text{[Tecnologia/Método]} + \text{[Lacuna / Limitação]} + \text{[Diferencial da Sua Equipe]}$$

#### Exemplo Prático de Redação (Caso do Projeto SELI - Ensino de LIBRAS):
> *"No trabalho desenvolvido por **Silva et al. (2023)**, foi proposta uma ferramenta digital para apoio à alfabetização em LIBRAS de crianças no ambiente escolar. Para isso, os autores implementaram uma aplicação desktop em linguagem C# com exercícios estáticos de múltipla escolha. Embora o sistema tenha auxiliado na fixação dos sinais básicos, ele apresenta como limitação a dependência de instalação local em computadores com sistema Windows, dificultando o acesso móvel. Diferentemente dessa abordagem, o presente projeto desenvolve uma plataforma 100% web, responsiva e com foco mobile-first, permitindo que estudantes e familiares pratiquem sinais interativos diretamente pelo navegador no smartphone, sem necessidade de download ou configuração prévia."*

---

### Regra 4: A Tabela Comparativa de Trabalhos Relacionados

Para facilitar a leitura e valorizar a fundamentação do paper, é altamente recomendável incluir um **quadro-resumo** na Seção 2 do Overleaf:

```latex
\begin{table}[ht]
\centering
\small
\caption{Quadro comparativo entre trabalhos correlatos e o projeto proposto.}
\label{tab:relacionados}
\begin{tabular}{|l|c|c|c|X|}
\hline
\textbf{Trabalho} & \textbf{Plataforma} & \textbf{Tecnologias} & \textbf{Público-Alvo} & \textbf{Diferencial do Nosso Projeto} \\ \hline
Silva et al. (2023) & Desktop & C\# / WPF & Ensino Infantil & Arquitetura Web, mobile-first e livre de instalação. \\ \hline
Santos (2024) & Mobile App & Flutter / Firebase & Ensino Médio & Recursos voltados à acessibilidade no IFSC Garopaba. \\ \hline
\textbf{Nossa Proposta} & \textbf{Web App} & \textbf{JS / HTML5 / Pages} & \textbf{Geral / IFSC} & \textbf{Acesso instantâneo e código aberto no GitHub.} \\ \hline
\end{tabular}
\end{table}
```

---

### Regra 5: Gestão das Referências no BibTeX (`references.bib`)

1. Na página do artigo na **Portal de Periódicos da UNIVALI**, localize e clique no botão **BibTeX** (ou no Google Acadêmico, clique no botão de aspas `"Citar"` -> `BibTeX`).
2. Copie o bloco de código gerado, por exemplo:
```bibtex
@inproceedings{silva2023libras,
  author    = {Silva, João and Oliveira, Maria},
  title     = {Ambiente Digital para Apoio ao Ensino de LIBRAS},
  booktitle = {Anais do XIV Computer on the Beach (COTB)},
  pages     = {120--129},
  year      = {2023},
  publisher = {SBC}
}
```
3. Abra o seu projeto no **Overleaf**, abra o arquivo `sbc-template.bib` (ou `references.bib`) e cole o código no final do arquivo.
4. No arquivo `.tex`, faça a citação no parágrafo usando:
   - `\cite{silva2023libras}` para citação entre colchetes: *"como visto em [Silva and Oliveira 2023]"*;
   - ou no texto: *"No trabalho de \citeauthor{silva2023libras} (\citeyear{silva2023libras}), foi proposto..."*.

---

## 📋 Checklist de Entrega no Final da Aula

1. Fazer login com a conta Google/IFSC institucional no canto superior do **Dashboard de PI-1**;
2. Localizar o card da sua Equipe e clicar no botão **`[+ Avanço]`**;
3. No campo de descrição, registrar:
   - **Artigo 1:** *Título completo, Autores, Ano, Link do artigo na Portal de Periódicos da UNIVALI e parágrafo crítico estruturado com o diferencial do seu software*;
   - **Artigo 2:** *Título completo, Autores, Ano, Link do artigo na Portal de Periódicos da UNIVALI e parágrafo crítico estruturado com o diferencial do seu software*;
   - Confirmação de que as citações BibTeX foram adicionadas ao Overleaf da equipe.
4. Clicar em **Salvar Registro**.
