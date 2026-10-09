#!/usr/bin/env python3
"""
Sincronização da Planilha Google Sheets com o Dashboard de Projeto Integrador I
Técnico Integrado em Informática (Turma Info 2025 - 2º Ano / 2026-2) — IFSC Câmpus Garopaba
"""

import csv
import io
import json
import re
import sys
import urllib.request

SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/15PBDpzugjiZJsEJEcbT6CHrNGcXB_OPKdZkfsHQf9RU/export?format=csv&gid=891834841"
TARGET_HTML = "2026-2/index.html"

def fetch_csv(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return response.read().decode('utf-8')

def parse_projects(csv_content):
    reader = csv.reader(io.StringIO(csv_content))
    rows = list(reader)
    
    header_idx = -1
    for i, row in enumerate(rows):
        if row and row[0].strip().upper() == "ID":
            header_idx = i
            break
            
    if header_idx == -1:
        print("Erro: Cabeçalho ID não encontrado no CSV.")
        return []
        
    projects = []
    data_rows = rows[header_idx + 1:]
    
    for row in data_rows:
        if not row or not row[0].strip():
            continue
            
        raw_id = row[0].strip()
        if not raw_id.isdigit():
            continue
            
        proj_id = int(raw_id)
        
        def get_col(idx, default=""):
            return row[idx].strip() if idx < len(row) and row[idx] else default

        title = get_col(1, f"Projeto #{proj_id}")
        team = get_col(2, "A definir")
        objective = get_col(3, "")
        github = get_col(4, "")
        overleaf = get_col(5, "")
        canva = get_col(6, "")
        pitch = get_col(7, "")
        related_works = get_col(8, "")
        
        exp1_title = get_col(9, "")
        exp1_res = get_col(10, "")
        exp2_title = get_col(11, "")
        exp2_res = get_col(12, "")
        exp3_title = get_col(13, "")
        exp3_res = get_col(14, "")
        exp4_title = get_col(15, "")
        exp4_res = get_col(16, "")
        
        paper1 = get_col(17, "")
        paper2 = get_col(18, "")
        paper3 = get_col(19, "")
        paper4 = get_col(20, "")
        
        advances = get_col(21, "")
        next_steps = get_col(22, "")
        difficulties = get_col(23, "")
        technologies = get_col(24, "")
        observations = get_col(25, "")

        projects.append({
            "id": proj_id,
            "title": title if title and title.upper() != "A DEFINIR" else f"Projeto #{proj_id} (Tema a Definir)",
            "rawTitle": title,
            "team": team,
            "objective": objective or "Objetivo em consolidação junto aos docentes orientadores.",
            "github": github,
            "overleaf": overleaf,
            "canva": canva,
            "pitch": pitch,
            "relatedWorks": related_works or "Pendente de inserção pela equipe.",
            "experiments": {
                "exp1": exp1_title or "PENDENTE",
                "exp2": exp2_title or "PENDENTE",
                "exp3": exp3_title or "PENDENTE",
                "exp4": exp4_title or "PENDENTE"
            },
            "experimentResults": {
                "exp1": exp1_res,
                "exp2": exp2_res,
                "exp3": exp3_res,
                "exp4": exp4_res
            },
            "papers": {
                "sepei": paper1 or "PENDENTE",
                "snct": paper2 or "PENDENTE",
                "paper3": paper3 or "PENDENTE",
                "cotb": paper4 or "PENDENTE"
            },
            "advances": advances or "Aguardando primeiro registro de atividades.",
            "nextSteps": next_steps or "Definição do escopo, repositório GitHub e artigo Overleaf.",
            "difficulties": difficulties or "Nenhuma dificuldade reportada no momento.",
            "technologies": [t.strip() for t in technologies.split(",") if t.strip()] if technologies else ["A definir"],
            "observations": observations
        })
        
    return projects

def update_html(projects):
    with open(TARGET_HTML, "r", encoding="utf-8") as f:
        content = f.read()
        
    json_str = json.dumps(projects, ensure_ascii=False, indent=2)
    
    pattern = r"const projectsData = \[[\s\S]*?\];"
    replacement = f"const projectsData = {json_str};"
    
    if not re.search(pattern, content):
        print("Aviso: const projectsData não encontrado para substituição regex.")
        return False
        
    new_content = re.sub(pattern, replacement, content, count=1)
    
    with open(TARGET_HTML, "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print(f"Sucesso! {len(projects)} projetos de PI-1 sincronizados no {TARGET_HTML}.")
    return True

def main():
    print(f"Baixando dados da planilha oficial de PI-1: {SHEET_CSV_URL}...")
    csv_content = fetch_csv(SHEET_CSV_URL)
    projects = parse_projects(csv_content)
    print(f"{len(projects)} projetos encontrados na planilha.")
    update_html(projects)

if __name__ == "__main__":
    main()
