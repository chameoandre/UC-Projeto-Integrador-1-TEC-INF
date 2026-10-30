/**
 * PI-1 Live Layer — Integração OAuth Google, Registros de Avanços, Dificuldades, Devolutivas Docentes e Demandas/Checkpoints.
 * IFSC Campus Garopaba - Turma Info 2025 / 2026-2
 */

(function () {
  'use strict';

  var cfg = window.PI1_CONFIG || {};
  var state = {
    usuario: null,
    idToken: localStorage.getItem('pi1_google_token') || '',
    registros: [],
    demandas: [],
    avaliacoes: [],
    carregando: false
  };

  // ============================ PARSER E COMPOSITOR DE OBJETIVOS ============================

  /**
   * Decompõe o texto da coluna 'objective' da planilha em Objetivo Geral e 4 Degraus Específicos.
   * Suporta formatos estruturados, listas numeradas e formato livre legado.
   */
  function decomporObjetivos(texto) {
    var padraoVazio = {
      geral: '',
      especificos: ['', '', '', ''],
      raw: texto || '',
      isPadrao: true
    };

    if (!texto || typeof texto !== 'string') return padraoVazio;
    var raw = texto.trim();
    if (!raw || raw === 'Objetivo em consolidação junto aos docentes orientadores.') {
      return padraoVazio;
    }

    var geral = '';
    var esp = ['', '', '', ''];

    // 1. Procura seções explícitas "Geral:" ou "[Objetivo Geral]" e "Específicos:" ou "[Objetivos Específicos]"
    var regexSecoes = /(?:^|\n)\s*(?:\[?\s*Objetivo\s+Geral\s*\]?|Geral)\s*[:\-\—]\s*([\s\S]*?)(?=(?:\n\s*(?:\[?\s*Objetivos?\s+Espec[ií]ficos?\s*\]?|Espec[ií]ficos?)\s*[:\-\—])|$)/i;
    var matchGeral = raw.match(regexSecoes);

    var regexEspBloco = /(?:^|\n)\s*(?:\[?\s*Objetivos?\s+Espec[ií]ficos?\s*\]?|Espec[ií]ficos?)\s*[:\-\—]\s*([\s\S]*)$/i;
    var matchEsp = raw.match(regexEspBloco);

    if (matchGeral && matchGeral[1] && matchEsp && matchEsp[1]) {
      geral = matchGeral[1].trim();
      extrairItensEspecificos(matchEsp[1].trim(), esp);
    } else if (matchEsp && matchEsp[1]) {
      var idx = raw.search(/(?:^|\n)\s*(?:\[?\s*Objetivos?\s+Espec[ií]ficos?\s*\]?|Espec[ií]ficos?)\s*[:\-\—]/i);
      geral = raw.substring(0, idx).replace(/^(?:\[?\s*Objetivo\s+Geral\s*\]?|Geral)\s*[:\-\—]\s*/i, '').trim();
      extrairItensEspecificos(matchEsp[1].trim(), esp);
    } else {
      // 2. Procura lista numerada 1., 2., 3., 4. no texto
      var idxNum = raw.search(/(?:^|\n)\s*(?:1[\.\)\:\-]|(?:Degrau|Objetivo\s*Espec[ií]fico)\s*1\b)/i);
      if (idxNum !== -1) {
        geral = raw.substring(0, idxNum).replace(/^(?:\[?\s*Objetivo\s+Geral\s*\]?|Geral)\s*[:\-\—]\s*/i, '').trim();
        var resto = raw.substring(idxNum).trim();
        extrairItensEspecificos(resto, esp);
      } else {
        // 3. Fallback: todo o texto é o objetivo geral
        geral = raw.replace(/^(?:\[?\s*Objetivo\s+Geral\s*\]?|Geral)\s*[:\-\—]\s*/i, '').trim();
      }
    }

    function extrairItensEspecificos(blocoTexto, outArr) {
      if (!blocoTexto) return;

      var regexItem = /(?:^|\n)\s*(?:[•\-*]\s*)?(?:(?:Degrau|Objetivo\s*Espec[ií]fico)\s*)?([1-4])\s*[\.\)\:\-]\s*(?:(?:Requisitos|Modelagem|C[oó]digo|Valida[cç][aã]o|Diagn[oó]stico|Implementa[cç][aã]o|Wireframes?|Testes?)[^:\n]*[:\-\—]\s*)?([\s\S]*?)(?=(?:\n\s*(?:[•\-*]\s*)?(?:(?:Degrau|Objetivo\s*Espec[ií]fico)\s*)?[1-4]\s*[\.\)\:\-])|$)/gi;

      var encontrou = false;
      var m;
      while ((m = regexItem.exec(blocoTexto)) !== null) {
        encontrou = true;
        var num = parseInt(m[1], 10);
        var itemConteudo = (m[2] || '').trim();
        itemConteudo = itemConteudo.replace(/^(?:(?:Degrau|Objetivo\s*Espec[ií]fico)\s*[1-4][^:\n]*[:\-\—]\s*|\([^\)]+\)\s*[:\-\—]?\s*)/i, '').trim();
        if (num >= 1 && num <= 4) {
          outArr[num - 1] = itemConteudo;
        }
      }

      if (!encontrou) {
        var partes = blocoTexto.split(/\n\s*\n|\n(?=[•\-\*]\s*)/)
          .map(function(p) { return p.replace(/^[•\-\*]\s*/, '').trim(); })
          .filter(Boolean);

        for (var i = 0; i < Math.min(partes.length, 4); i++) {
          outArr[i] = partes[i].replace(/^[1-4][\.\)\:\-]\s*/, '').trim();
        }
      }
    }

    return {
      geral: geral,
      especificos: esp,
      raw: raw,
      isPadrao: false
    };
  }

  /**
   * Compõe o texto unificado para armazenamento na coluna 'objective' da planilha Google Sheets.
   */
  function comporObjetivos(geral, especificos) {
    var nomesDegraus = [
      'Degrau 1 (Requisitos & Diagnóstico)',
      'Degrau 2 (Modelagem & Wireframe)',
      'Degrau 3 (Implementação & Código)',
      'Degrau 4 (Validação & Testes)'
    ];

    var partes = [];
    var geralLimpo = (geral || '').trim();
    if (geralLimpo) {
      partes.push('Objetivo Geral:\n' + geralLimpo);
    }

    var espLimpos = (especificos || []).map(function(e) { return (e || '').trim(); });
    var temEsp = espLimpos.some(function(e) { return e.length > 0; });

    if (temEsp) {
      var linhasEsp = ['Objetivos Específicos:'];
      for (var i = 0; i < 4; i++) {
        if (espLimpos[i]) {
          linhasEsp.push((i + 1) + '. ' + nomesDegraus[i] + ': ' + espLimpos[i]);
        }
      }
      partes.push(linhasEsp.join('\n'));
    }

    return partes.join('\n\n').trim();
  }

  window.decomporObjetivos = decomporObjetivos;
  window.comporObjetivos = comporObjetivos;

  // ============================ AUTENTICAÇÃO OAUTH ============================

  function inicializarAuth() {
    renderNotasTab();
    var authContainer = document.getElementById('pi1-auth');
    if (!authContainer) return;

    if (!cfg.googleClientId) {
      authContainer.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);">OAuth não configurado</span>';
      return;
    }

    if (state.idToken) {
      validarToken(state.idToken);
    } else {
      renderizarBotaoLogin();
    }
  }

  function renderizarBotaoLogin() {
    var authContainer = document.getElementById('pi1-auth');
    if (!authContainer) return;

    authContainer.innerHTML = '<div id="g_id_signin_btn"></div>';

    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: tratarRespostaLogin,
        auto_select: false
      });
      window.google.accounts.id.renderButton(
        document.getElementById('g_id_signin_btn'),
        { theme: 'outline', size: 'medium', text: 'signin_with', shape: 'pill' }
      );
    } else {
      setTimeout(renderizarBotaoLogin, 300);
    }
  }

  function tratarRespostaLogin(resp) {
    if (!resp || !resp.credential) return;
    state.idToken = resp.credential;
    localStorage.setItem('pi1_google_token', state.idToken);
    validarToken(state.idToken);
  }

  function logout() {
    state.usuario = null;
    state.idToken = '';
    localStorage.removeItem('pi1_google_token');
    renderizarBotaoLogin();
    if (typeof window.renderProjects === 'function') window.renderProjects();
    renderDemandasTab();
    renderNotasTab();
    if (typeof window.showToast === 'function') window.showToast('Sessão encerrada.');
  }

  async function apiCall(acao, payload) {
    if (!cfg.apiUrl) return { ok: false, erro: 'API URL não configurada' };
    try {
      var body = Object.assign({ acao: acao, idToken: state.idToken }, payload || {});
      var resp = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
      return await resp.json();
    } catch (e) {
      console.error('Erro na chamada da API:', e);
      return { ok: false, erro: e.message };
    }
  }

  async function validarToken(token) {
    var authContainer = document.getElementById('pi1-auth');
    if (authContainer) authContainer.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);">Autenticando...</span>';

    if (!cfg.apiUrl) {
      // Fallback decodificando payload JWT local para teste visual
      try {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        var data = JSON.parse(jsonPayload);
        state.usuario = {
          nome: data.name || data.email.split('@')[0],
          email: data.email,
          papel: (data.email.indexOf('andre.moraes@ifsc.edu.br') >= 0 || data.email.indexOf('chameoandre@gmail.com') >= 0) ? 'docente' : 'aluno',
          projetos: ['*'],
          status: 'ativo'
        };
        renderizarEstadoUsuario();
        sincronizarRegistros();
        return;
      } catch (e) {
        logout();
        return;
      }
    }

    var res = await apiCall('whoami');
    if (res.ok && res.usuario) {
      state.usuario = res.usuario;
      renderizarEstadoUsuario();
      sincronizarRegistros();
    } else {
      logout();
    }
  }

  function renderizarEstadoUsuario() {
    var authContainer = document.getElementById('pi1-auth');
    if (!authContainer || !state.usuario) return;

    var papelClass = state.usuario.papel === 'docente' ? 'docente' : 'aluno';
    var papelTxt = state.usuario.papel === 'docente' ? 'Docente' : (state.usuario.status === 'ativo' ? 'Estudante' : 'Pendente');

    authContainer.innerHTML = `
      <div class="pi1-auth-container">
        ${state.usuario.papel === 'docente' ? `
          <button class="btn-action" id="pi1-btn-painel-docente" style="background:var(--accent-purple);color:#fff;font-size:0.78rem;padding:0.35rem 0.65rem;" title="Gerenciar membros e solicitações">
            <i class="fa-solid fa-users-gear"></i> Painel Docente
          </button>
          <button class="btn-action" id="pi1-btn-notas-top" style="background:var(--accent-amber);color:#fff;font-size:0.78rem;padding:0.35rem 0.65rem;" title="Painel Central de Notas & Avaliações">
            <i class="fa-solid fa-clipboard-list"></i> Notas & Avaliações
          </button>
          <button class="btn-action" id="pi1-btn-criar-demanda-top" style="background:var(--accent-blue);color:#fff;font-size:0.78rem;padding:0.35rem 0.65rem;" title="Criar nova demanda docente">
            <i class="fa-solid fa-bullhorn"></i> Nova Demanda
          </button>
        ` : `
          <button class="btn-action" id="pi1-btn-notas-top" style="background:rgba(245,158,11,0.15);color:var(--accent-amber);border:1px solid rgba(245,158,11,0.3);font-size:0.78rem;padding:0.35rem 0.65rem;" title="Ver Minhas Notas & Avaliações">
            <i class="fa-solid fa-clipboard-list"></i> Minhas Notas
          </button>
        `}
        <div class="pi1-user-badge">
          <span>${escapeHtml(state.usuario.nome)}</span>
          <span class="pi1-user-role ${papelClass}">${papelTxt}</span>
        </div>
        <button class="pi1-btn-logout" id="pi1-btn-sair" title="Sair da conta">Sair</button>
      </div>
    `;

    var btnSair = document.getElementById('pi1-btn-sair');
    if (btnSair) btnSair.addEventListener('click', logout);

    var btnPainel = document.getElementById('pi1-btn-painel-docente');
    if (btnPainel) btnPainel.addEventListener('click', abrirPainelDocente);

    var btnNotasTop = document.getElementById('pi1-btn-notas-top');
    if (btnNotasTop) {
      btnNotasTop.addEventListener('click', function () {
        if (typeof window.switchTab === 'function') window.switchTab('notas');
        else renderNotasTab();
      });
    }

    var btnDemandaTop = document.getElementById('pi1-btn-criar-demanda-top');
    if (btnDemandaTop) btnDemandaTop.addEventListener('click', function () { abrirModalCriarDemanda('*'); });

    if (typeof window.renderProjects === 'function') window.renderProjects();
    renderDemandasTab();
    renderNotasTab();
  }

  // ============================ REGISTROS, DEMANDAS E PROJETOS AO VIVO ============================

  var SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/15PBDpzugjiZJsEJEcbT6CHrNGcXB_OPKdZkfsHQf9RU/export?format=csv&gid=891834841';

  function aplicarProjetos(novos) {
    if (!novos || !novos.length) return;
    // Guardrail de integridade: rejeitar dados do PI-II se vierem por cache antigo do navegador ou URL indevida
    var contemPI2 = novos.some(function (p) {
      var t = (p.title || '') + ' ' + (p.rawTitle || '') + ' ' + (p.team || '');
      return t.indexOf('SMC') >= 0 || t.indexOf('JifTV') >= 0 || t.indexOf('RasPorta') >= 0 || t.indexOf('Joel Jorge') >= 0;
    });
    if (contemPI2) {
      console.warn('[PI1] Atenção: Dados recebidos contêm projetos do PI-II (cache antigo ou endpoint trocado). Rejeitando substituição de projetos do PI-I.');
      return;
    }
    window.projectsData = novos;
    if (typeof projectsData !== 'undefined' && Array.isArray(projectsData)) {
      projectsData.length = 0;
      novos.forEach(function (p) { projectsData.push(p); });
    }
    var badge = document.getElementById('tab-badge-projetos');
    if (badge) badge.textContent = novos.length;
  }

  async function sincronizarRegistros(manual) {
    var syncIcon = document.getElementById('sync-icon');
    if (syncIcon) syncIcon.classList.add('fa-spin');

    var atualizou = false;

    // 1. Tenta carregar via Apps Script API (dados mais recentes + registros + demandas) com cache-busting anti-stale
    if (cfg.apiUrl) {
      try {
        var sep = cfg.apiUrl.indexOf('?') >= 0 ? '&' : '?';
        var apiUrlBuster = cfg.apiUrl + sep + '_t=' + Date.now();
        var resp = await fetch(apiUrlBuster, { cache: 'no-store' });
        var data = await resp.json();
        if (data.ok) {
          if (data.projetos && data.projetos.length > 0) {
            aplicarProjetos(data.projetos);
            atualizou = true;
          }
          if (data.registros) state.registros = data.registros;
          if (data.demandas) state.demandas = data.demandas;
          if (data.avaliacoes) state.avaliacoes = data.avaliacoes;
        }
      } catch (e) {
        console.warn('Falha ao carregar pela API Apps Script, tentando fallback CSV:', e);
      }
    }

    // 2. Fallback ou sincronização direta do CSV da planilha pública
    if (!atualizou) {
      try {
        var respCsv = await fetch(SHEET_CSV_URL + '&_t=' + Date.now(), { cache: 'no-store' });
        var csvTxt = await respCsv.text();
        var projsCsv = parsearCsvProjetos(csvTxt);
        if (projsCsv && projsCsv.length > 0) {
          aplicarProjetos(projsCsv);
          atualizou = true;
        }
      } catch (errCsv) {
        console.warn('Falha ao sincronizar CSV direto da planilha:', errCsv);
      }
    }

    if (typeof window.renderProjects === 'function') {
      window.renderProjects();
    }
    renderDemandasTab();
    renderNotasTab();

    if (syncIcon) {
      setTimeout(function () {
        syncIcon.classList.remove('fa-spin');
      }, 500);
    }

    if (manual && typeof window.showToast === 'function') {
      window.showToast('Projetos sincronizados com a planilha oficial!');
    }
  }

  function parsearCsvProjetos(csvText) {
    var lines = [];
    var row = [];
    var cur = '';
    var inQuotes = false;

    for (var i = 0; i < csvText.length; i++) {
      var c = csvText[i];
      var next = csvText[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(cur);
        cur = '';
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        row.push(cur);
        cur = '';
        lines.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
    if (cur || row.length) {
      row.push(cur);
      lines.push(row);
    }

    var headerIdx = -1;
    for (var r = 0; r < lines.length; r++) {
      if (lines[r][0] && String(lines[r][0]).trim().toUpperCase() === 'ID') {
        headerIdx = r;
        break;
      }
    }
    if (headerIdx === -1) return [];

    var projs = [];
    for (var r = headerIdx + 1; r < lines.length; r++) {
      var rowData = lines[r];
      if (!rowData || !rowData[0]) continue;
      var rawId = String(rowData[0]).trim();
      if (!/^\d+$/.test(rawId)) continue;

      var pId = Number(rawId);
      function col(idx, padrao) {
        return (rowData[idx] ? String(rowData[idx]).trim() : '') || padrao || '';
      }

      projs.push({
        id: pId,
        title: col(1, 'Projeto #' + pId),
        rawTitle: col(1, ''),
        team: col(2, 'A definir'),
        objective: col(3, 'Objetivo em consolidação junto aos docentes orientadores.'),
        github: col(4, ''),
        overleaf: col(5, ''),
        canva: col(6, ''),
        pitch: col(7, ''),
        relatedWorks: col(8, 'Pendente de inserção pela equipe.'),
        experiments: {
          exp1: col(9, 'PENDENTE'),
          exp2: col(11, 'PENDENTE'),
          exp3: col(13, 'PENDENTE'),
          exp4: col(15, 'PENDENTE')
        },
        experimentResults: {
          exp1: col(10, ''),
          exp2: col(12, ''),
          exp3: col(14, ''),
          exp4: col(16, '')
        },
        papers: {
          sepei: col(17, 'PENDENTE'),
          snct: col(18, 'PENDENTE'),
          paper3: col(19, 'PENDENTE'),
          cotb: col(20, 'PENDENTE')
        },
        advances: col(21, 'Aguardando primeiro registro de atividades.'),
        nextSteps: col(22, 'Definição do escopo, repositório GitHub e artigo Overleaf.'),
        difficulties: col(23, 'Nenhuma dificuldade reportada no momento.'),
        technologies: col(24, 'A definir').split(/[,;]/).map(function (t) { return t.trim(); }).filter(Boolean),
        observations: col(25, '')
      });
    }
    return projs;
  }

  // Sobrescrever liveSyncFromSheet global para usar a sincronização inteligente
  window.liveSyncFromSheet = function () {
    sincronizarRegistros(true);
  };

  function podeEditarProjeto(projId) {
    if (!state.usuario || state.usuario.status !== 'ativo') return false;
    if (state.usuario.papel === 'docente') return true;
    var projs = state.usuario.projetos || [];
    return projs.indexOf(String(projId)) >= 0 || projs.indexOf('*') >= 0;
  }

  function abrirModalAvanco(projId) {
    if (!state.usuario) {
      alert('Autenticação Obrigatória:\nPor favor, faça login com sua conta Google/IFSC no canto superior direito para registrar avanços ou dificuldades.');
      return;
    }
    if (!podeEditarProjeto(projId)) {
      if (state.usuario.status === 'pendente') {
        alert('Seu pedido de acesso para o Projeto #' + (state.usuario.projetos.join(', ') || projId) + ' está aguardando aprovação do professor.');
      } else {
        abrirModalSolicitarAcesso(projId);
      }
      return;
    }

    var modal = document.getElementById('projectModal');
    var modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return;

    var demandasAbertas = state.demandas.filter(function (d) {
      return (d.projeto === '*' || Number(d.projeto) === projId) && d.status !== 'concluida';
    });

    modalContent.innerHTML = `
      <div style="margin-bottom:1rem;">
        <span class="proj-badge">PROJETO #${projId}</span>
        <h2 style="font-size:1.35rem;font-weight:700;margin-top:0.4rem;color:var(--text-main);">Registrar Avanço / Dificuldade</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;">Os dados serão sincronizados com a planilha oficial e o orientador será notificado por e-mail.</p>
      </div>
      <form id="pi1-form-registro" class="pi1-modal-form">
        ${demandasAbertas.length > 0 ? `
          <div class="pi1-form-group" style="background:var(--chip-bg);padding:0.75rem;border-radius:var(--radius-sm);border:1px solid var(--border-color);">
            <label style="color:var(--accent-cyan);"><i class="fa-solid fa-link"></i> Este avanço cumpre alguma demanda do orientador?</label>
            <select id="pi1-reg-demanda">
              <option value="">Nenhuma / Avanço geral de rotina</option>
              ${demandasAbertas.map(function(d) {
                return `<option value="${d.id}">[${d.projeto === '*' ? 'Geral' : '#' + d.projeto}] ${escapeHtml(d.titulo)} (Prazo: ${escapeHtml(d.prazo || 'Sem prazo')})</option>`;
              }).join('')}
            </select>
          </div>
        ` : ''}
        <div class="pi1-form-group">
          <label>O que a equipe realizou recentemente? *</label>
          <textarea id="pi1-reg-texto" rows="3" required placeholder="Ex: Desenvolvemos o diagrama de arquitetura no draw.io e estruturamos as pastas no GitHub..."></textarea>
        </div>
        <div class="pi1-form-group">
          <label>Dificuldades / Bloqueios encontrados</label>
          <textarea id="pi1-reg-dificuldades" rows="2" placeholder="Ex: Dúvida na escolha do banco de dados ou integração com API..."></textarea>
          <span class="pi1-form-hint">O docente será notificado por e-mail para responder com uma devolutiva.</span>
        </div>
        <div class="pi1-form-group">
          <label>Próximos Passos planejados</label>
          <textarea id="pi1-reg-passos" rows="2" placeholder="Ex: Iniciar a codificação do frontend e validar requisitos..."></textarea>
        </div>
        <div class="pi1-modal-footer">
          <button type="button" class="btn-detail" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn-action" style="background:var(--ifsc-green);color:#fff;" id="pi1-btn-submit-reg">
            <i class="fa-solid fa-floppy-disk"></i> Salvar Registro
          </button>
        </div>
      </form>
    `;

    document.getElementById('pi1-form-registro').onsubmit = async function (e) {
      e.preventDefault();
      var btn = document.getElementById('pi1-btn-submit-reg');
      btn.disabled = true;
      btn.innerText = 'Gravando...';

      var selDemanda = document.getElementById('pi1-reg-demanda');
      var demandaId = selDemanda ? selDemanda.value : '';

      var payload = {
        projetoId: projId,
        texto: document.getElementById('pi1-reg-texto').value.trim(),
        dificuldades: document.getElementById('pi1-reg-dificuldades').value.trim(),
        proximosPassos: document.getElementById('pi1-reg-passos').value.trim(),
        demandaId: demandaId,
        tipo: 'avanco'
      };

      var res = await apiCall('registrar', payload);
      if (res.ok) {
        if (typeof window.showToast === 'function') window.showToast('Avanço registrado com sucesso!');
        else alert('Avanço registrado com sucesso!');
        if (typeof window.closeModal === 'function') window.closeModal();
        sincronizarRegistros();
      } else {
        alert('Erro ao salvar: ' + (res.erro || 'Não foi possível registrar'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Registro';
      }
    };

    modal.classList.add('open');
  }

  // ============================ GESTÃO DE DEMANDAS / CHECKPOINTS ============================

  function abrirModalCriarDemanda(projPredefinido) {
    if (!state.usuario || state.usuario.papel !== 'docente') {
      alert('Apenas docentes podem criar demandas para os projetos.');
      return;
    }

    var modal = document.getElementById('projectModal');
    var modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return;

    modalContent.innerHTML = `
      <div style="margin-bottom:1.25rem;">
        <span class="proj-badge">ORIENTAÇÃO DOCENTE</span>
        <h2 style="font-size:1.35rem;font-weight:700;margin-top:0.4rem;color:var(--text-main);">Criar Nova Demanda / Checkpoint</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;">Defina metas específicas por projeto ou dispare para todos os 11 grupos simultaneamente.</p>
      </div>
      <form id="pi1-form-criar-demanda" class="pi1-modal-form">
        <div class="pi1-form-group">
          <label>Escopo da Demanda (Alvo) *</label>
          <select id="pi1-dem-projeto" required>
            <option value="*" ${projPredefinido === '*' ? 'selected' : ''}>📣 TODOS OS PROJETOS (Broadcast Geral)</option>
            ${[1,2,3,4,5,6,7,8,9,10,11].map(function(num) {
              return `<option value="${num}" ${String(projPredefinido) === String(num) ? 'selected' : ''}>Projeto #${num}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="pi1-form-group">
          <label>Título da Demanda / Meta *</label>
          <input type="text" id="pi1-dem-titulo" required placeholder="Ex: Entrega do Diagrama de Arquitetura e Estrutura no GitHub" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div class="pi1-form-group">
            <label>Data Limite / Prazo Sugerido</label>
            <input type="date" id="pi1-dem-prazo" />
          </div>
          <div class="pi1-form-group">
            <label>Pontos / Peso Avaliativo</label>
            <input type="text" id="pi1-dem-pontos" placeholder="Ex: 10,0 pts ou Peso 2" />
          </div>
        </div>
        <div class="pi1-form-group">
          <label>Critérios de Aceite & Rubrica Avaliada</label>
          <textarea id="pi1-dem-criterios" rows="2" placeholder="Ex: 1. Verbo no infinitivo; 2. Entrega no Overleaf; 3. Sem estudos passivos..."></textarea>
        </div>
        <div class="pi1-form-group">
          <label>Orientações Gerais</label>
          <textarea id="pi1-dem-desc" rows="3" placeholder="Descreva os requisitos para conclusão desta meta..."></textarea>
          <span class="pi1-form-hint">Os estudantes destinatários receberão uma notificação imediata por e-mail.</span>
        </div>
        <div class="pi1-modal-footer">
          <button type="button" class="btn-detail" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn-action" style="background:var(--accent-blue);color:#fff;" id="pi1-btn-submit-dem">
            <i class="fa-solid fa-paper-plane"></i> Publicar & Notificar E-mail
          </button>
        </div>
      </form>
    `;

    document.getElementById('pi1-form-criar-demanda').onsubmit = async function (e) {
      e.preventDefault();
      var btn = document.getElementById('pi1-btn-submit-dem');
      btn.disabled = true;
      btn.innerText = 'Disparando...';

      var payload = {
        projeto: document.getElementById('pi1-dem-projeto').value,
        titulo: document.getElementById('pi1-dem-titulo').value.trim(),
        prazo: document.getElementById('pi1-dem-prazo').value,
        pontos: (document.getElementById('pi1-dem-pontos') ? document.getElementById('pi1-dem-pontos').value.trim() : ''),
        criterios: (document.getElementById('pi1-dem-criterios') ? document.getElementById('pi1-dem-criterios').value.trim() : ''),
        descricao: document.getElementById('pi1-dem-desc').value.trim()
      };

      var res = await apiCall('criarDemanda', payload);
      if (res.ok) {
        if (typeof window.showToast === 'function') window.showToast('Demanda criada e e-mails enviados com sucesso!');
        else alert('Demanda criada e e-mails enviados com sucesso!');
        if (typeof window.closeModal === 'function') window.closeModal();
        sincronizarRegistros();
      } else {
        alert('Erro ao criar demanda: ' + (res.erro || 'Falha na requisição'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar & Notificar E-mail';
      }
    };

    modal.classList.add('open');
  }

  async function concluirDemanda(demandaId) {
    if (!state.usuario) {
      alert('Faça login para concluir esta demanda.');
      return;
    }

    var texto = prompt('Informe uma breve justificativa ou link de evidência da conclusão:');
    if (texto === null) return;

    var res = await apiCall('concluirDemanda', { demandaId: demandaId, texto: texto });
    if (res.ok) {
      if (typeof window.showToast === 'function') window.showToast('Demanda marcada como concluída!');
      sincronizarRegistros();
    } else {
      alert('Erro: ' + (res.erro || 'Não foi possível concluir'));
    }
  }

  async function removerDemanda(demandaId) {
    if (!state.usuario || state.usuario.papel !== 'docente') return;
    if (!confirm('Deseja realmente remover esta demanda?')) return;

    var res = await apiCall('removerDemanda', { demandaId: demandaId });
    if (res.ok) {
      if (typeof window.showToast === 'function') window.showToast('Demanda removida.');
      sincronizarRegistros();
    } else {
      alert('Erro: ' + (res.erro || 'Não foi possível remover'));
    }
  }

  function renderDemandasTab() {
    var container = document.getElementById('tab-demandas');
    if (!container) return;

    var demandas = state.demandas || [];
    var isDocente = state.usuario && state.usuario.papel === 'docente';

    if (demandas.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3.5rem 1rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color); color: var(--text-muted);">
          <i class="fa-solid fa-list-check" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--text-dim);"></i>
          <h3 style="color:var(--text-main);font-size:1.15rem;margin-bottom:0.35rem;">Nenhuma Demanda Ativa no Momento</h3>
          <p style="font-size:0.88rem;max-width:480px;margin:0 auto 1.25rem;">O professor orientador pode criar demandas e checkpoints para guiar as entregas dos grupos.</p>
          ${isDocente ? `
            <button class="btn-action" onclick="PI1.abrirModalCriarDemanda('*')" style="background:var(--accent-blue);color:#fff;">
              <i class="fa-solid fa-plus"></i> Criar Primeira Demanda
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    var pendentes = demandas.filter(function (d) { return d.status !== 'concluida'; });
    var concluidas = demandas.filter(function (d) { return d.status === 'concluida'; });

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <div>
          <h3 style="font-size:1.25rem;font-weight:700;color:var(--text-main);margin-bottom:0.25rem;">Demandas & Checkpoints da Turma</h3>
          <p style="font-size:0.85rem;color:var(--text-muted);">Acompanhamento de metas direcionadas pelo professor orientador.</p>
        </div>
        ${isDocente ? `
          <button class="btn-action" onclick="PI1.abrirModalCriarDemanda('*')" style="background:var(--accent-blue);color:#fff;">
            <i class="fa-solid fa-plus"></i> Nova Demanda / Broadcast
          </button>
        ` : ''}
      </div>

      <div class="pi1-demandas-grid">
        ${demandas.map(function(d) {
          var isBroadcast = d.projeto === '*';
          var isDone = d.status === 'concluida';
          var podeConcluir = state.usuario && (isDocente || podeEditarProjeto(d.projeto));

          return `
            <div class="pi1-demanda-card ${isDone ? 'concluida' : ''}">
              <div>
                <div class="pi1-demanda-header">
                  <div style="display:flex;gap:0.35rem;align-items:center;flex-wrap:wrap;">
                    <span class="${isBroadcast ? 'pi1-badge-broadcast' : 'pi1-badge-projeto'}">
                      ${isBroadcast ? '<i class="fa-solid fa-bullhorn"></i> Geral (Turma)' : 'Projeto #' + d.projeto}
                    </span>
                    ${d.pontos ? `<span class="proj-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;font-size:0.68rem;border:1px solid rgba(245,158,11,0.3);"><i class="fa-solid fa-star"></i> ${escapeHtml(d.pontos)}</span>` : ''}
                  </div>
                  <span class="status-tag ${isDone ? 'tag-ok' : 'tag-pendente'}">
                    ${isDone ? '<i class="fa-solid fa-check"></i> Concluída' : '<i class="fa-solid fa-clock"></i> Pendente'}
                  </span>
                </div>
                <h4 class="pi1-demanda-title">${escapeHtml(d.titulo)}</h4>
                <p class="pi1-demanda-desc">${escapeHtml(d.descricao || 'Sem descrição adicional.')}</p>
                ${d.criterios ? `
                  <div style="background:var(--chip-bg);border:1px solid var(--border-color);border-radius:6px;padding:0.45rem 0.65rem;margin-bottom:0.75rem;font-size:0.78rem;color:var(--text-muted);">
                    <strong style="color:var(--accent-blue);"><i class="fa-solid fa-list-check"></i> Critérios / Rubrica:</strong> ${escapeHtml(d.criterios)}
                  </div>
                ` : ''}
              </div>

              <div>
                <div class="pi1-demanda-meta">
                  <span class="pi1-demanda-prazo">
                    <i class="fa-solid fa-calendar-day"></i> ${d.prazo ? ('Prazo: ' + escapeHtml(d.prazo)) : 'Sem data limite'}
                  </span>
                  <span style="font-size:0.75rem;">Por: ${escapeHtml(d.criadoPor)}</span>
                </div>

                <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.75rem;padding-top:0.5rem;border-top:1px solid var(--border-color);">
                  ${(!isDone && podeConcluir) ? `
                    <button class="btn-detail" onclick="PI1.concluirDemanda('${d.id}')" style="color:var(--ifsc-green-light);border-color:rgba(34,197,94,0.3);">
                      <i class="fa-solid fa-check-double"></i> Concluir
                    </button>
                  ` : ''}
                  ${isDocente ? `
                    <button class="btn-detail" onclick="PI1.removerDemanda('${d.id}')" style="color:var(--ifsc-red);border-color:rgba(239,68,68,0.3);" title="Excluir demanda">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderNotasTab() {
    var container = document.getElementById('tab-notas');
    if (!container) return;

    var projetos = (typeof window.projectsData !== 'undefined' && Array.isArray(window.projectsData) && window.projectsData.length > 0)
      ? window.projectsData
      : ((typeof projectsData !== 'undefined' && Array.isArray(projectsData)) ? projectsData : []);

    var avaliacoes = state.avaliacoes || [];
    var isDocente = state.usuario && state.usuario.papel === 'docente';
    var meuProjetoId = (state.usuario && state.usuario.projetos) ? Number(state.usuario.projetos) : null;

    // Calcular estatísticas e KPIs
    var totalProjetos = projetos.length;
    var avaliadosCount = 0;
    var aprovadosCount = 0;
    var ajustarCount = 0;
    var somaNotas = 0;
    var countNotasValidas = 0;

    var projsComAval = projetos.map(function (p) {
      var aval = avaliacoes.find(function (a) {
        return Number(a.projeto) === Number(p.id) && a.tipo === 'objetivos';
      });
      var status = aval ? aval.status : 'pendente';
      var nota = aval && aval.nota !== undefined && aval.nota !== '' ? parseFloat(String(aval.nota).replace(',', '.')) : null;

      if (aval) {
        avaliadosCount++;
        if (status === 'aprovado') aprovadosCount++;
        else if (status === 'ajustar') ajustarCount++;
        if (!isNaN(nota) && nota !== null) {
          somaNotas += nota;
          countNotasValidas++;
        }
      }

      return {
        projeto: p,
        avaliacao: aval,
        status: status,
        nota: nota
      };
    });

    var mediaNotas = countNotasValidas > 0 ? (somaNotas / countNotasValidas).toFixed(1) : '—';
    var pendentesCount = totalProjetos - avaliadosCount;

    // Se o usuário logado for estudante de um projeto, encontrar sua avaliação
    var avaliacaoMeuProjeto = meuProjetoId ? projsComAval.find(function (item) { return Number(item.projeto.id) === meuProjetoId; }) : null;

    container.innerHTML = `
      <div class="pi1-notas-container">
        
        <!-- CABEÇALHO DO PAINEL -->
        <div class="pi1-notas-header">
          <div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;">
              <span class="proj-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;font-weight:700;">
                <i class="fa-solid fa-clipboard-list"></i> PAINEL CENTRAL DE AVALIAÇÕES & NOTAS
              </span>
              <span style="font-size:0.75rem;color:var(--text-dim);">Turma INF-2025</span>
            </div>
            <h2 style="font-size:1.35rem;font-weight:700;color:var(--text-main);margin:0;">
              Acompanhamento de Rubricas Pedagógicas & Roteiro 1
            </h2>
            <p style="font-size:0.85rem;color:var(--text-muted);margin:0.25rem 0 0 0;">
              Conformidade do Objetivo Geral (4 critérios) e dos 4 Degraus Específicos (Exploração, Modelagem, Implementação e Validação).
            </p>
          </div>

          <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
            ${isDocente ? `
              <button class="btn-action" onclick="PI1.sincronizar(true)" style="background:var(--accent-blue);color:#fff;font-size:0.8rem;padding:0.45rem 0.85rem;" title="Atualizar dados da planilha">
                <i class="fa-solid fa-arrows-rotate"></i> Sincronizar
              </button>
            ` : `
              <button class="btn-action" onclick="PI1.sincronizar(true)" style="background:var(--chip-bg);color:var(--text-main);border:1px solid var(--border-color);font-size:0.8rem;padding:0.45rem 0.85rem;">
                <i class="fa-solid fa-arrows-rotate"></i> Atualizar
              </button>
            `}
          </div>
        </div>

        <!-- DESTAQUE PARA ESTUDANTE LOGADO -->
        ${(avaliacaoMeuProjeto && !isDocente) ? `
          <div class="pi1-aluno-destaque">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;">
              <div>
                <span class="proj-badge" style="background:rgba(37,99,235,0.15);color:var(--accent-blue);font-weight:700;">
                  <i class="fa-solid fa-star"></i> SUA EQUIPE — PROJETO #${avaliacaoMeuProjeto.projeto.id}
                </span>
                <h3 style="font-size:1.2rem;font-weight:700;color:var(--text-main);margin:0.35rem 0 0.15rem 0;">
                  ${escapeHtml(avaliacaoMeuProjeto.projeto.title || avaliacaoMeuProjeto.projeto.rawTitle || avaliacaoMeuProjeto.projeto.nome || ('Projeto #' + avaliacaoMeuProjeto.projeto.id))}
                </h3>
                <span style="font-size:0.8rem;color:var(--text-muted);"><i class="fa-solid fa-users"></i> ${escapeHtml(avaliacaoMeuProjeto.projeto.team || avaliacaoMeuProjeto.projeto.integrantes || 'Integrantes a definir')}</span>
              </div>
              <div style="display:flex;gap:0.75rem;align-items:center;">
                <div style="text-align:right;">
                  <div style="font-size:0.75rem;color:var(--text-dim);font-weight:600;text-transform:uppercase;">Nota Roteiro 1</div>
                  <div class="pi1-nota-val ${avaliacaoMeuProjeto.nota !== null ? (avaliacaoMeuProjeto.nota >= 7 ? 'excelente' : 'ajuste') : ''}" style="font-size:1.4rem;">
                    ${avaliacaoMeuProjeto.nota !== null ? avaliacaoMeuProjeto.nota.toFixed(1) : 'Em avaliação'}
                  </div>
                </div>
                <div>
                  <div style="font-size:0.75rem;color:var(--text-dim);font-weight:600;text-transform:uppercase;">Parecer Geral</div>
                  <span class="status-tag ${avaliacaoMeuProjeto.status === 'aprovado' ? 'tag-ok' : (avaliacaoMeuProjeto.status === 'ajustar' ? 'tag-ajuste' : 'tag-pendente')}" style="padding:0.4rem 0.75rem;font-size:0.82rem;">
                    ${avaliacaoMeuProjeto.status === 'aprovado' ? '🟢 Conforme' : (avaliacaoMeuProjeto.status === 'ajustar' ? '🟡 Requer Ajustes' : '⚪ Em Elaboração')}
                  </span>
                </div>
              </div>
            </div>

            ${avaliacaoMeuProjeto.avaliacao && avaliacaoMeuProjeto.avaliacao.parecer ? `
              <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;padding:0.85rem 1.15rem;margin-bottom:0.75rem;">
                <strong style="font-size:0.85rem;color:var(--accent-blue);display:flex;align-items:center;gap:0.35rem;margin-bottom:0.35rem;">
                  <i class="fa-solid fa-comment-dots"></i> Devolutiva do Professor Orientador:
                </strong>
                <p style="font-size:0.88rem;color:var(--text-main);margin:0;line-height:1.5;">${escapeHtml(avaliacaoMeuProjeto.avaliacao.parecer)}</p>
              </div>
            ` : ''}

            <!-- 4 Degraus Específicos do Aluno -->
            ${(avaliacaoMeuProjeto.avaliacao && avaliacaoMeuProjeto.avaliacao.criterios) ? `
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:0.6rem;margin-top:0.75rem;">
                <div style="background:var(--bg-card);padding:0.6rem 0.8rem;border-radius:6px;border:1px solid var(--border-color);font-size:0.78rem;">
                  <strong>D1 (Exploração):</strong> <span class="pi1-deg-badge ${avaliacaoMeuProjeto.avaliacao.criterios.esp1_status || 'ausente'}">${(avaliacaoMeuProjeto.avaliacao.criterios.esp1_status === 'conforme' ? '✔️ Conforme' : (avaliacaoMeuProjeto.avaliacao.criterios.esp1_status === 'ajustar' ? '⚠️ Ajustar' : '❌ Ausente'))}</span>
                  ${avaliacaoMeuProjeto.avaliacao.criterios.esp1_obs ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.25rem;">${escapeHtml(avaliacaoMeuProjeto.avaliacao.criterios.esp1_obs)}</div>` : ''}
                </div>
                <div style="background:var(--bg-card);padding:0.6rem 0.8rem;border-radius:6px;border:1px solid var(--border-color);font-size:0.78rem;">
                  <strong>D2 (Modelagem):</strong> <span class="pi1-deg-badge ${avaliacaoMeuProjeto.avaliacao.criterios.esp2_status || 'ausente'}">${(avaliacaoMeuProjeto.avaliacao.criterios.esp2_status === 'conforme' ? '✔️ Conforme' : (avaliacaoMeuProjeto.avaliacao.criterios.esp2_status === 'ajustar' ? '⚠️ Ajustar' : '❌ Ausente'))}</span>
                  ${avaliacaoMeuProjeto.avaliacao.criterios.esp2_obs ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.25rem;">${escapeHtml(avaliacaoMeuProjeto.avaliacao.criterios.esp2_obs)}</div>` : ''}
                </div>
                <div style="background:var(--bg-card);padding:0.6rem 0.8rem;border-radius:6px;border:1px solid var(--border-color);font-size:0.78rem;">
                  <strong>D3 (Implementação):</strong> <span class="pi1-deg-badge ${avaliacaoMeuProjeto.avaliacao.criterios.esp3_status || 'ausente'}">${(avaliacaoMeuProjeto.avaliacao.criterios.esp3_status === 'conforme' ? '✔️ Conforme' : (avaliacaoMeuProjeto.avaliacao.criterios.esp3_status === 'ajustar' ? '⚠️ Ajustar' : '❌ Ausente'))}</span>
                  ${avaliacaoMeuProjeto.avaliacao.criterios.esp3_obs ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.25rem;">${escapeHtml(avaliacaoMeuProjeto.avaliacao.criterios.esp3_obs)}</div>` : ''}
                </div>
                <div style="background:var(--bg-card);padding:0.6rem 0.8rem;border-radius:6px;border:1px solid var(--border-color);font-size:0.78rem;">
                  <strong>D4 (Validação):</strong> <span class="pi1-deg-badge ${avaliacaoMeuProjeto.avaliacao.criterios.esp4_status || 'ausente'}">${(avaliacaoMeuProjeto.avaliacao.criterios.esp4_status === 'conforme' ? '✔️ Conforme' : (avaliacaoMeuProjeto.avaliacao.criterios.esp4_status === 'ajustar' ? '⚠️ Ajustar' : '❌ Ausente'))}</span>
                  ${avaliacaoMeuProjeto.avaliacao.criterios.esp4_obs ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.25rem;">${escapeHtml(avaliacaoMeuProjeto.avaliacao.criterios.esp4_obs)}</div>` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- QUADRO DE KPIS CONSOLIDADOS -->
        <div class="pi1-notas-kpi-grid">
          <div class="pi1-kpi-card">
            <span class="pi1-kpi-val">${totalProjetos}</span>
            <span class="pi1-kpi-lbl">Equipes na Turma</span>
          </div>
          <div class="pi1-kpi-card">
            <span class="pi1-kpi-val" style="color:var(--ifsc-green);">${aprovadosCount}</span>
            <span class="pi1-kpi-lbl">Objetivos Aprovados</span>
          </div>
          <div class="pi1-kpi-card">
            <span class="pi1-kpi-val" style="color:#f59e0b;">${ajustarCount}</span>
            <span class="pi1-kpi-lbl">Requerem Ajustes</span>
          </div>
          <div class="pi1-kpi-card">
            <span class="pi1-kpi-val" style="color:var(--text-dim);">${pendentesCount}</span>
            <span class="pi1-kpi-lbl">Em Elaboração / Sem Nota</span>
          </div>
          <div class="pi1-kpi-card">
            <span class="pi1-kpi-val" style="color:var(--accent-blue);">${mediaNotas}</span>
            <span class="pi1-kpi-lbl">Média da Turma</span>
          </div>
        </div>

        <!-- BARRA DE FILTROS E BUSCA -->
        <div class="pi1-notas-toolbar">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <input type="text" id="pi1-notas-search" class="pi1-search-input" placeholder="🔍 Buscar por projeto ou integrante..." oninput="PI1.filtrarTabelaNotas()" />
            <button class="btn-detail active-filter" id="pi1-filter-btn-todos" onclick="PI1.filtrarNotasPorStatus('todos')" style="font-size:0.75rem;padding:0.35rem 0.65rem;">Todos (${totalProjetos})</button>
            <button class="btn-detail" id="pi1-filter-btn-aprovado" onclick="PI1.filtrarNotasPorStatus('aprovado')" style="font-size:0.75rem;padding:0.35rem 0.65rem;color:var(--ifsc-green);">🟢 Conformes (${aprovadosCount})</button>
            <button class="btn-detail" id="pi1-filter-btn-ajustar" onclick="PI1.filtrarNotasPorStatus('ajustar')" style="font-size:0.75rem;padding:0.35rem 0.65rem;color:#d97706;">🟡 Ajustar (${ajustarCount})</button>
            <button class="btn-detail" id="pi1-filter-btn-pendente" onclick="PI1.filtrarNotasPorStatus('pendente')" style="font-size:0.75rem;padding:0.35rem 0.65rem;color:var(--text-dim);">⚪ Pendentes (${pendentesCount})</button>
          </div>
          ${isDocente ? `
            <div style="font-size:0.8rem;color:var(--accent-purple);font-weight:600;">
              <i class="fa-solid fa-user-shield"></i> Modo Docente Ativo — Edição de Notas Habilitada
            </div>
          ` : ''}
        </div>

        <!-- TABELA CONSOLIDADA DAS 11 EQUIPES -->
        <div class="pi1-notas-table-wrapper">
          <table class="pi1-notas-table" id="pi1-tabela-notas">
            <thead>
              <tr>
                <th style="width:45px;">#</th>
                <th style="min-width:200px;">Projeto & Equipe</th>
                <th style="min-width:140px;">Objetivo Geral</th>
                <th style="min-width:240px;">4 Degraus Específicos</th>
                <th style="min-width:110px;">Status</th>
                <th style="width:90px;text-align:center;">Nota</th>
                <th style="min-width:200px;">Parecer Orientador</th>
                <th style="min-width:110px;text-align:right;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${projsComAval.map(function (item) {
                var p = item.projeto;
                var a = item.avaliacao;
                var nomeProj = p.title || p.rawTitle || p.nome || ('Projeto #' + p.id);
                var integrantesProj = p.team || p.integrantes || 'Integrantes a definir';
                var crit = a && a.criterios ? a.criterios : {};
                var statusClass = item.status === 'aprovado' ? 'tag-ok' : (item.status === 'ajustar' ? 'tag-ajuste' : 'tag-pendente');
                var statusLabel = item.status === 'aprovado' ? '🟢 Conforme' : (item.status === 'ajustar' ? '🟡 Ajustar' : '⚪ Pendente');
                var notaTxt = item.nota !== null ? item.nota.toFixed(1) : '—';
                var notaClass = item.nota !== null ? (item.nota >= 7.0 ? 'excelente' : 'ajuste') : '';

                return `
                  <tr class="pi1-nota-row" data-id="${p.id}" data-status="${item.status}" data-nome="${escapeHtml(nomeProj).toLowerCase()}" data-integrantes="${escapeHtml(integrantesProj).toLowerCase()}">
                    <td>
                      <span class="proj-badge" style="font-weight:700;">#${p.id}</span>
                    </td>
                    <td>
                      <strong style="color:var(--text-main);font-size:0.92rem;display:block;margin-bottom:0.2rem;">${escapeHtml(nomeProj)}</strong>
                      <div style="font-size:0.75rem;color:var(--text-dim);line-height:1.3;">
                        <i class="fa-solid fa-users" style="color:var(--accent-blue);"></i> ${escapeHtml(integrantesProj)}
                      </div>
                    </td>
                    <td>
                      ${crit.geral_status ? `
                        <span class="status-tag ${crit.geral_status === 'conforme' ? 'tag-ok' : 'tag-ajuste'}" style="font-size:0.72rem;">
                          ${crit.geral_status === 'conforme' ? '✔️ Conforme' : '⚠️ Revisar'}
                        </span>
                        <div style="font-size:0.68rem;color:var(--text-dim);margin-top:0.25rem;">
                          ${crit.geral_verbo ? '✓ Verbo ' : ''}${crit.geral_produto ? '✓ Produto ' : ''}${crit.geral_publico ? '✓ Público ' : ''}${crit.geral_proposito ? '✓ Propósito' : ''}
                        </div>
                      ` : '<span style="font-size:0.75rem;color:var(--text-dim);">Não avaliado</span>'}
                    </td>
                    <td>
                      <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                        <span class="pi1-deg-badge ${crit.esp1_status || 'ausente'}" title="D1: Exploração e Referenciais (${crit.esp1_obs || 'Sem obs'})">
                          D1: ${crit.esp1_status === 'conforme' ? '✔️' : (crit.esp1_status === 'ajustar' ? '⚠️' : '❌')}
                        </span>
                        <span class="pi1-deg-badge ${crit.esp2_status || 'ausente'}" title="D2: Modelagem, WBS e Wireframe (${crit.esp2_obs || 'Sem obs'})">
                          D2: ${crit.esp2_status === 'conforme' ? '✔️' : (crit.esp2_status === 'ajustar' ? '⚠️' : '❌')}
                        </span>
                        <span class="pi1-deg-badge ${crit.esp3_status || 'ausente'}" title="D3: Implementação Web e GitHub (${crit.esp3_obs || 'Sem obs'})">
                          D3: ${crit.esp3_status === 'conforme' ? '✔️' : (crit.esp3_status === 'ajustar' ? '⚠️' : '❌')}
                        </span>
                        <span class="pi1-deg-badge ${crit.esp4_status || 'ausente'}" title="D4: Validação e Testes (${crit.esp4_obs || 'Sem obs'})">
                          D4: ${crit.esp4_status === 'conforme' ? '✔️' : (crit.esp4_status === 'ajustar' ? '⚠️' : '❌')}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span class="status-tag ${statusClass}" style="font-size:0.72rem;">
                        ${statusLabel}
                      </span>
                    </td>
                    <td style="text-align:center;">
                      <span class="pi1-nota-val ${notaClass}">
                        ${notaTxt}
                      </span>
                    </td>
                    <td>
                      <div style="font-size:0.78rem;color:var(--text-muted);max-width:280px;line-height:1.35;" title="${escapeHtml(a && a.parecer ? a.parecer : '')}">
                        ${a && a.parecer ? escapeHtml(a.parecer.length > 80 ? a.parecer.substring(0, 80) + '...' : a.parecer) : '<span style="color:var(--text-dim);">Nenhum parecer emitido</span>'}
                      </div>
                    </td>
                    <td style="text-align:right;">
                      <div style="display:flex;gap:0.35rem;justify-content:flex-end;">
                        ${isDocente ? `
                          <button class="btn-action" onclick="PI1.abrirModalAvaliarObjetivos(${p.id})" style="background:var(--accent-amber);color:#fff;font-size:0.72rem;padding:0.3rem 0.55rem;" title="Avaliar ou editar nota do Projeto #${p.id}">
                            <i class="fa-solid fa-pen-to-square"></i> Avaliar
                          </button>
                        ` : ''}
                        <button class="btn-detail" onclick="openModal(${p.id})" style="font-size:0.72rem;padding:0.3rem 0.55rem;" title="Abrir ficha do Projeto #${p.id}">
                          <i class="fa-solid fa-eye"></i> Ficha
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

      </div>
    `;
  }

  function filtrarTabelaNotas() {
    var search = (document.getElementById('pi1-notas-search') ? document.getElementById('pi1-notas-search').value : '').toLowerCase().trim();
    var rows = document.querySelectorAll('.pi1-nota-row');
    rows.forEach(function (row) {
      var nome = row.getAttribute('data-nome') || '';
      var intg = row.getAttribute('data-integrantes') || '';
      var id = row.getAttribute('data-id') || '';
      var match = !search || nome.includes(search) || intg.includes(search) || id === search;
      var curHidden = row.getAttribute('data-status-hidden') === 'true';
      if (!match || curHidden) {
        row.style.display = 'none';
      } else {
        row.style.display = '';
      }
    });
  }

  function filtrarNotasPorStatus(status) {
    ['todos', 'aprovado', 'ajustar', 'pendente'].forEach(function (s) {
      var btn = document.getElementById('pi1-filter-btn-' + s);
      if (btn) {
        if (s === status) btn.classList.add('active-filter');
        else btn.classList.remove('active-filter');
      }
    });

    var rows = document.querySelectorAll('.pi1-nota-row');
    rows.forEach(function (row) {
      var rowStatus = row.getAttribute('data-status');
      if (status === 'todos' || rowStatus === status) {
        row.removeAttribute('data-status-hidden');
      } else {
        row.setAttribute('data-status-hidden', 'true');
      }
    });
    filtrarTabelaNotas();
  }

  function abrirModalSolicitarAcesso(projId) {
    var modal = document.getElementById('projectModal');
    var modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return;

    modalContent.innerHTML = `
      <div style="margin-bottom:1rem;">
        <span class="proj-badge">SOLICITAÇÃO DE ACESSO</span>
        <h2 style="font-size:1.35rem;font-weight:700;margin-top:0.4rem;color:var(--text-main);">Vincular ao Projeto #${projId}</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;">Você está autenticado como <strong>${escapeHtml(state.usuario.email)}</strong>. Envie seu pedido para o professor orientador.</p>
      </div>
      <form id="pi1-form-solicitar" class="pi1-modal-form">
        <div class="pi1-form-group">
          <label>Seu Nome Completo *</label>
          <input type="text" id="pi1-sol-nome" value="${escapeHtml(state.usuario.nome)}" required />
        </div>
        <div class="pi1-modal-footer">
          <button type="button" class="btn-detail" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn-action" style="background:var(--accent-blue);color:#fff;" id="pi1-btn-submit-sol">
            <i class="fa-solid fa-user-plus"></i> Solicitar Acesso
          </button>
        </div>
      </form>
    `;

    document.getElementById('pi1-form-solicitar').onsubmit = async function (e) {
      e.preventDefault();
      var btn = document.getElementById('pi1-btn-submit-sol');
      btn.disabled = true;
      btn.innerText = 'Enviando...';

      var res = await apiCall('solicitarAcesso', {
        projeto: projId,
        nome: document.getElementById('pi1-sol-nome').value.trim()
      });

      if (res.ok) {
        alert('Pedido enviado com sucesso! O professor aprovará seu acesso em breve.');
        if (typeof window.closeModal === 'function') window.closeModal();
        validarToken(state.idToken);
      } else {
        alert('Erro: ' + (res.erro || 'Falha ao solicitar'));
        btn.disabled = false;
        btn.innerText = 'Solicitar Acesso';
      }
    };

    modal.classList.add('open');
  }

  async function abrirPainelDocente() {
    var modal = document.getElementById('projectModal');
    var modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return;

    modalContent.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Carregando painel...</div>';
    modal.classList.add('open');

    var res = await apiCall('painel');
    if (!res.ok) {
      modalContent.innerHTML = '<div style="color:var(--ifsc-red);padding:1rem;">Erro ao carregar painel: ' + escapeHtml(res.erro) + '</div>';
      return;
    }

    var membros = res.membros || [];
    var pendentes = membros.filter(function (m) { return m.status === 'pendente'; });

    modalContent.innerHTML = `
      <div style="margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--border-color);">
        <span class="proj-badge">GESTÃO DOCENTE</span>
        <h2 style="font-size:1.4rem;font-weight:700;margin-top:0.4rem;color:var(--text-main);">Painel de Acessos e Integrantes</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;">Gerencie as autorizações de edição dos estudantes por projeto.</p>
      </div>

      <div style="background:var(--chip-bg);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:0.75rem 1rem;margin-bottom:1.25rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
        <div>
          <strong style="color:var(--text-main);font-size:0.9rem;"><i class="fa-solid fa-clipboard-list" style="color:var(--accent-amber);"></i> Painel Central de Notas & Avaliações</strong>
          <p style="font-size:0.78rem;color:var(--text-muted);margin:0.15rem 0 0 0;">Controle das notas dos 11 projetos e rubricas dos objetivos.</p>
        </div>
        <button class="btn-action" style="background:var(--accent-amber);color:#fff;font-size:0.78rem;padding:0.35rem 0.75rem;" onclick="closeModal(); switchTab('notas');">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Acessar Notas
        </button>
      </div>

      <div style="margin-bottom:1.5rem;">
        <h4 style="font-size:0.9rem;color:var(--accent-amber);margin-bottom:0.75rem;">
          <i class="fa-solid fa-clock"></i> Solicitações Pendentes (${pendentes.length})
        </h4>
        ${pendentes.length === 0 ? '<p style="font-size:0.82rem;color:var(--text-dim);">Nenhuma solicitação pendente no momento.</p>' : `
          <div style="display:flex;flex-direction:column;gap:0.6rem;">
            ${pendentes.map(function(p) {
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;background:var(--chip-bg);padding:0.75rem 1rem;border-radius:var(--radius-sm);border:1px solid var(--border-color);">
                  <div>
                    <strong>${escapeHtml(p.nome)}</strong> (${escapeHtml(p.email)})<br/>
                    <span style="font-size:0.78rem;color:var(--text-muted);">Solicitou acesso ao <strong>Projeto #${p.projetos}</strong></span>
                  </div>
                  <div style="display:flex;gap:0.5rem;">
                    <button class="btn-action" style="background:var(--ifsc-green);color:#fff;font-size:0.75rem;padding:0.35rem 0.6rem;" onclick="PI1.decidirAcesso('${p.email}', 'aprovar', '${p.projetos}')">
                      <i class="fa-solid fa-check"></i> Aprovar
                    </button>
                    <button class="btn-action" style="background:var(--ifsc-red);color:#fff;font-size:0.75rem;padding:0.35rem 0.6rem;" onclick="PI1.decidirAcesso('${p.email}', 'recusar', '')">
                      <i class="fa-solid fa-xmark"></i> Recusar
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <div>
        <h4 style="font-size:0.9rem;color:var(--accent-cyan);margin-bottom:0.75rem;">
          <i class="fa-solid fa-users"></i> Todos os Membros Cadastrados (${membros.length})
        </h4>
        <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-sm);">
          <table style="width:100%;border-collapse:collapse;font-size:0.8rem;text-align:left;">
            <thead>
              <tr style="background:var(--chip-bg);color:var(--text-muted);">
                <th style="padding:0.5rem;">Nome / E-mail</th>
                <th style="padding:0.5rem;">Projeto</th>
                <th style="padding:0.5rem;">Papel</th>
                <th style="padding:0.5rem;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${membros.map(function(m) {
                return `
                  <tr style="border-top:1px solid var(--border-color);">
                    <td style="padding:0.5rem;"><strong>${escapeHtml(m.nome || m.email)}</strong><br/><span style="color:var(--text-dim);font-size:0.72rem;">${escapeHtml(m.email)}</span></td>
                    <td style="padding:0.5rem;">#${m.projetos}</td>
                    <td style="padding:0.5rem;">${m.papel}</td>
                    <td style="padding:0.5rem;"><span class="status-tag ${m.status === 'ativo' ? 'tag-ok' : 'tag-pendente'}">${m.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="pi1-modal-footer">
        <button type="button" class="btn-detail" onclick="closeModal()">Fechar</button>
      </div>
    `;
  }

  async function decidirAcesso(email, decisao, projetos) {
    var res = await apiCall('decidirAcesso', { email: email, decisao: decisao, projetos: projetos });
    if (res.ok) {
      if (typeof window.showToast === 'function') window.showToast('Solicitação ' + (decisao === 'aprovar' ? 'aprovada' : 'recusada') + '!');
      abrirPainelDocente();
    } else {
      alert('Erro: ' + (res.erro || 'Falha ao processar'));
    }
  }

  function abrirModalDevolutiva(regId, projId, textoOriginal) {
    if (!state.usuario || state.usuario.papel !== 'docente') {
      alert('Apenas docentes podem registrar devolutivas.');
      return;
    }

    var modal = document.getElementById('projectModal');
    var modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return;

    modalContent.innerHTML = `
      <div style="margin-bottom:1rem;">
        <span class="proj-badge">ORIENTAÇÃO DOCENTE</span>
        <h2 style="font-size:1.35rem;font-weight:700;margin-top:0.4rem;color:var(--text-main);">Devolutiva do Orientador</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;">Projeto #${projId} — A equipe receberá esta devolutiva por e-mail.</p>
      </div>
      <div style="background:var(--chip-bg);padding:0.85rem;border-radius:var(--radius-sm);border:1px solid var(--border-color);font-size:0.85rem;margin-bottom:1rem;">
        <strong style="color:var(--accent-amber);"><i class="fa-solid fa-triangle-exclamation"></i> Relato da Equipe:</strong>
        <p style="margin-top:0.35rem;color:var(--text-main);">${escapeHtml(textoOriginal)}</p>
      </div>
      <form id="pi1-form-devolutiva" class="pi1-modal-form">
        <div class="pi1-form-group">
          <label>Devolutiva / Orientações *</label>
          <textarea id="pi1-dev-texto" rows="4" required placeholder="Escreva aqui a orientação técnica ou feedback para a equipe..."></textarea>
          <span class="pi1-form-hint">A equipe do projeto receberá um e-mail com a sua orientação.</span>
        </div>
        <div class="pi1-modal-footer">
          <button type="button" class="btn-detail" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn-action" style="background:var(--ifsc-green);color:#fff;" id="pi1-btn-submit-dev">
            <i class="fa-solid fa-paper-plane"></i> Enviar Devolutiva
          </button>
        </div>
      </form>
    `;

    document.getElementById('pi1-form-devolutiva').onsubmit = async function (e) {
      e.preventDefault();
      var btn = document.getElementById('pi1-btn-submit-dev');
      btn.disabled = true;
      btn.innerText = 'Enviando...';

      var payload = {
        registroId: regId,
        devolutiva: document.getElementById('pi1-dev-texto').value.trim()
      };

      var res = await apiCall('salvarDevolutiva', payload);
      if (res.ok) {
        if (typeof window.showToast === 'function') window.showToast('Devolutiva enviada com sucesso!');
        else alert('Devolutiva enviada com sucesso!');
        if (typeof window.closeModal === 'function') window.closeModal();
        sincronizarRegistros();
      } else {
        alert('Erro ao enviar: ' + (res.erro || 'Falha na comunicação'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Devolutiva';
      }
    };

    modal.classList.add('open');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function abrirModalEditarFicha(projId) {
    if (!state.usuario) {
      alert('Autenticação Obrigatória:\nPor favor, faça login com sua conta Google/IFSC no canto superior direito para editar a ficha do projeto.');
      return;
    }
    if (!podeEditarProjeto(projId)) {
      if (state.usuario.status === 'pendente') {
        alert('Seu pedido de acesso para o Projeto #' + (state.usuario.projetos.join(', ') || projId) + ' está aguardando aprovação do professor.');
      } else {
        abrirModalSolicitarAcesso(projId);
      }
      return;
    }

    var proj = (typeof window.projectsData !== 'undefined' ? window.projectsData : []).find(function(p) { return p.id === projId; }) || {};
    var modal = document.getElementById('projectModal');
    var modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return;

    var isDocente = state.usuario.papel === 'docente';
    var objInfo = decomporObjetivos(proj.objective);

    modalContent.innerHTML = `
      <div style="margin-bottom:1.25rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border-color);">
        <span class="proj-badge">PROJETO #${projId}</span>
        <h2 style="font-size:1.35rem;font-weight:700;margin-top:0.4rem;color:var(--text-main);">Editar Ficha & Links do Projeto</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;">Preencha os objetivos, link do Overleaf e trabalhos relacionados. As alterações são sincronizadas com a planilha oficial.</p>
      </div>
      <form id="pi1-form-editar-ficha" class="pi1-modal-form">
        ${isDocente ? `
          <div class="pi1-form-group">
            <label>Título do Projeto *</label>
            <input type="text" id="pi1-ficha-title" value="${escapeHtml(proj.title || '')}" required />
          </div>
          <div class="pi1-form-group">
            <label>Integrantes da Equipe *</label>
            <input type="text" id="pi1-ficha-team" value="${escapeHtml(proj.team || '')}" required />
          </div>
        ` : `
          <div style="background:var(--chip-bg);padding:0.75rem 1rem;border-radius:var(--radius-sm);border:1px solid var(--border-color);margin-bottom:0.5rem;">
            <strong style="color:var(--text-main);">${escapeHtml(proj.title || 'Projeto #' + projId)}</strong><br/>
            <span style="font-size:0.8rem;color:var(--text-muted);"><i class="fa-solid fa-users"></i> ${escapeHtml(proj.team || '')}</span>
          </div>
        `}

        <!-- 1. OBJETIVO GERAL INDEPENDENTE -->
        <div class="pi1-form-group">
          <label style="font-size:0.9rem;font-weight:700;color:var(--text-main);display:flex;align-items:center;gap:0.4rem;">
            <i class="fa-solid fa-bullseye" style="color:var(--accent-cyan);"></i> Objetivo Geral (A Grande Meta do Software) *
          </label>
          <textarea id="pi1-ficha-obj-geral" rows="2" required placeholder="Ex: Desenvolver uma plataforma web para apoio à aprendizagem de LIBRAS voltada a estudantes do ensino fundamental, visando facilitar a inclusão e a comunicação acessível...">${escapeHtml(objInfo.geral || '')}</textarea>
          <span class="pi1-form-hint">Fórmula Roteiro 1: <code>[Verbo no Infinitivo] + [Produto Tangível] + [Público/Contexto] + [Impacto/Benefício Real]</code>.</span>
        </div>

        <!-- 2. OBJETIVOS ESPECÍFICOS (4 CAIXAS DE TEXTO INDEPENDENTES) -->
        <div class="pi1-form-degraus-box">
          <div class="pi1-form-degraus-head">
            <div>
              <h4 style="margin:0;font-size:0.92rem;color:var(--ifsc-green-light);display:flex;align-items:center;gap:0.4rem;">
                <i class="fa-solid fa-stairs"></i> Objetivos Específicos (Os 4 Degraus de Execução Técnica)
              </h4>
              <span class="pi1-form-hint" style="margin-top:0.2rem;display:block;">
                Preencha cada degrau da execução prática do software separadamente. Evite tarefas de estudo passivo (ex: "estudar JS", "ler artigos"); cada caixa deve ser uma entrega técnica concreta!
              </span>
            </div>
          </div>

          <div class="pi1-degraus-inputs-grid">
            <!-- Degrau 1 -->
            <div class="pi1-degrau-input-item">
              <label class="pi1-degrau-input-label d1">
                <span class="d-num">1</span>
                <span>Degrau 1 • Requisitos & Diagnóstico</span>
              </label>
              <textarea id="pi1-ficha-obj-esp1" rows="2" placeholder="Ex: Mapear as principais necessidades dos usuários interessados em aprender LIBRAS, considerando acessibilidade e facilidade de aprendizagem...">${escapeHtml(objInfo.especificos[0] || '')}</textarea>
              <span class="pi1-form-hint">Verbos de ação: Mapear, Identificar, Levantar, Investigar necessidades reais.</span>
            </div>

            <!-- Degrau 2 -->
            <div class="pi1-degrau-input-item">
              <label class="pi1-degrau-input-label d2">
                <span class="d-num">2</span>
                <span>Degrau 2 • Modelagem & Design (draw.io / Wireframes)</span>
              </label>
              <textarea id="pi1-ficha-obj-esp2" rows="2" placeholder="Ex: Modelar a arquitetura da informação e diagramas de fluxo no draw.io e prototipar wireframes de navegação acessível...">${escapeHtml(objInfo.especificos[1] || '')}</textarea>
              <span class="pi1-form-hint">Verbos de ação: Modelar arquitetura, Prototipar wireframes, Projetar fluxos.</span>
            </div>

            <!-- Degrau 3 -->
            <div class="pi1-degrau-input-item">
              <label class="pi1-degrau-input-label d3">
                <span class="d-num">3</span>
                <span>Degrau 3 • Implementação & Código (Git / GitHub / Web)</span>
              </label>
              <textarea id="pi1-ficha-obj-esp3" rows="2" placeholder="Ex: Desenvolver a aplicação web interativa em HTML5, CSS3 e JavaScript versionada no GitHub com deploy contínuo no GitHub Pages...">${escapeHtml(objInfo.especificos[2] || '')}</textarea>
              <span class="pi1-form-hint">Verbos de ação: Desenvolver código, Codificar frontend/backend, Versionar no Git.</span>
            </div>

            <!-- Degrau 4 -->
            <div class="pi1-degrau-input-item">
              <label class="pi1-degrau-input-label d4">
                <span class="d-num">4</span>
                <span>Degrau 4 • Validação & Avaliação Experimental</span>
              </label>
              <textarea id="pi1-ficha-obj-esp4" rows="2" placeholder="Ex: Validar a usabilidade e a interatividade da plataforma através de testes com a turma, coletando métricas de retenção e facilidade de uso...">${escapeHtml(objInfo.especificos[3] || '')}</textarea>
              <span class="pi1-form-hint">Verbos de ação: Validar com usuários, Testar usabilidade, Mensurar métricas empíricas.</span>
            </div>
          </div>
        </div>

        <div class="pi1-form-group">
          <label><i class="fa-solid fa-file-lines" style="color:var(--accent-amber);"></i> Link de Leitura do Overleaf (/read/) *</label>
          <input type="url" id="pi1-ficha-overleaf" value="${escapeHtml(proj.overleaf || '')}" placeholder="https://www.overleaf.com/read/xxxxxxxxx" />
          <span class="pi1-form-hint" style="color:var(--accent-amber);"><i class="fa-solid fa-shield-halved"></i> No Overleaf: Share > Anyone with this link can view (deve conter /read/).</span>
        </div>

        <div class="pi1-form-group">
          <label><i class="fa-solid fa-book" style="color:var(--accent-cyan);"></i> Trabalhos Relacionados (COTB / SBC) *</label>
          <textarea id="pi1-ficha-relatedWorks" rows="3" placeholder="Ex: 1) Silva et al. (2023) - Propôs um app de... Nosso projeto diferencia-se por... 2) Souza (2024)...">${escapeHtml(proj.relatedWorks && proj.relatedWorks !== 'Pendente de inserção pela equipe.' ? proj.relatedWorks : '')}</textarea>
          <span class="pi1-form-hint">Descreva os 2 artigos encontrados nos anais do Computer on the Beach.</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div class="pi1-form-group">
            <label><i class="fa-brands fa-github"></i> Repositório GitHub</label>
            <input type="url" id="pi1-ficha-github" value="${escapeHtml(proj.github || '')}" placeholder="https://github.com/..." />
          </div>
          <div class="pi1-form-group">
            <label><i class="fa-solid fa-diagram-project"></i> Diagrama (draw.io / Canva)</label>
            <input type="url" id="pi1-ficha-canva" value="${escapeHtml(proj.canva || '')}" placeholder="https://..." />
          </div>
        </div>

        <div class="pi1-form-group">
          <label><i class="fa-solid fa-video"></i> Pitch em Vídeo</label>
          <input type="url" id="pi1-ficha-pitch" value="${escapeHtml(proj.pitch || '')}" placeholder="https://youtube.com/... ou drive..." />
        </div>

        <div class="pi1-modal-footer">
          <button type="button" class="btn-detail" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn-action" style="background:var(--ifsc-green);color:#fff;" id="pi1-btn-submit-ficha">
            <i class="fa-solid fa-floppy-disk"></i> Salvar Ficha do Projeto
          </button>
        </div>
      </form>
    `;

    document.getElementById('pi1-form-editar-ficha').onsubmit = async function(e) {
      e.preventDefault();
      var btn = document.getElementById('pi1-btn-submit-ficha');
      var ovUrl = document.getElementById('pi1-ficha-overleaf').value.trim();

      if (ovUrl && ovUrl.indexOf('overleaf.com') >= 0 && ovUrl.indexOf('/read/') === -1) {
        alert('Atenção: O link do Overleaf deve ser o link de LEITURA (contendo /read/).\nNo Overleaf, vá em Share > Anyone with this link can view.');
        return;
      }

      btn.disabled = true;
      btn.innerText = 'Salvando na planilha...';

      var objGeralVal = document.getElementById('pi1-ficha-obj-geral').value.trim();
      var esp1Val = document.getElementById('pi1-ficha-obj-esp1').value.trim();
      var esp2Val = document.getElementById('pi1-ficha-obj-esp2').value.trim();
      var esp3Val = document.getElementById('pi1-ficha-obj-esp3').value.trim();
      var esp4Val = document.getElementById('pi1-ficha-obj-esp4').value.trim();
      var objFinal = comporObjetivos(objGeralVal, [esp1Val, esp2Val, esp3Val, esp4Val]);

      var campos = {
        objective: objFinal,
        relatorio: ovUrl,
        relatedWorks: document.getElementById('pi1-ficha-relatedWorks').value.trim(),
        github: document.getElementById('pi1-ficha-github').value.trim(),
        canva: document.getElementById('pi1-ficha-canva').value.trim(),
        pitch: document.getElementById('pi1-ficha-pitch').value.trim()
      };

      if (isDocente) {
        var elTitle = document.getElementById('pi1-ficha-title');
        var elTeam = document.getElementById('pi1-ficha-team');
        if (elTitle) campos.title = elTitle.value.trim();
        if (elTeam) campos.team = elTeam.value.trim();
      }

      var res = await apiCall('atualizarFicha', { projeto: projId, campos: campos });
      if (res.ok) {
        if (typeof window.showToast === 'function') window.showToast('Ficha do projeto atualizada com sucesso!');
        else alert('Ficha do projeto atualizada com sucesso!');
        if (typeof window.closeModal === 'function') window.closeModal();
        
        // Atualizar objeto local em projectsData
        Object.assign(proj, {
          objective: campos.objective || proj.objective,
          overleaf: campos.relatorio || proj.overleaf,
          relatedWorks: campos.relatedWorks || proj.relatedWorks,
          github: campos.github || proj.github,
          canva: campos.canva || proj.canva,
          pitch: campos.pitch || proj.pitch
        });
        if (campos.title) proj.title = campos.title;
        if (campos.team) proj.team = campos.team;

        if (typeof window.renderProjects === 'function') window.renderProjects();
        sincronizarRegistros();
      } else {
        alert('Erro ao salvar ficha: ' + (res.erro || 'Falha na requisição'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Ficha do Projeto';
      }
    };

    modal.classList.add('open');
  }

  // ============================ AVALIAÇÃO DE OBJETIVOS & RUBRICAS ============================

  function abrirModalAvaliarObjetivos(projId) {
    if (!state.usuario || state.usuario.papel !== 'docente') {
      alert('Apenas docentes podem realizar avaliações formais dos projetos.');
      return;
    }

    var proj = (window.projectsData || []).find(function (p) { return p.id === Number(projId); });
    if (!proj) {
      alert('Projeto #' + projId + ' não encontrado.');
      return;
    }

    var modal = document.getElementById('projectModal');
    var modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return;

    // Busca avaliação existente de objetivos deste projeto
    var aval = (state.avaliacoes || []).find(function (a) {
      return Number(a.projeto) === Number(projId) && a.tipo === 'objetivos';
    });

    var crit = (aval && aval.criterios) ? aval.criterios : {};
    var notaAtual = aval ? (aval.nota || '') : '';
    var statusAtual = aval ? (aval.status || 'aprovado') : 'aprovado';
    var parecerAtual = aval ? (aval.parecer || '') : '';

    var textoObjetivo = proj.objective || 'Nenhum objetivo registrado até o momento.';

    modalContent.innerHTML = `
      <div style="margin-bottom:1.25rem;">
        <span class="proj-badge">RUBRICA ROTEIRO 1 — AVALIAÇÃO DE OBJETIVOS</span>
        <h2 style="font-size:1.35rem;font-weight:700;margin-top:0.4rem;color:var(--text-main);">
          #${proj.id} ${escapeHtml(proj.title)}
        </h2>
        <div style="color:var(--accent-cyan);font-size:0.85rem;"><i class="fa-solid fa-users"></i> ${escapeHtml(proj.team)}</div>
      </div>

      <!-- Texto cadastrado pelos estudantes com destaque separado -->
      <div class="pi1-obj-preview-box">
        <div class="pi1-obj-preview-title">
          <i class="fa-solid fa-file-lines"></i> Redação Atual dos Objetivos (Cadastrada pela Equipe)
        </div>
        ${(function () {
          var decomposto = decomporObjetivos(textoObjetivo);
          var esp = decomposto.especificos;
          var temEsp = esp.some(Boolean);
          if (!temEsp && (!decomposto.geral || decomposto.geral === 'Objetivo em consolidação junto aos docentes orientadores.')) {
            return `<div class="pi1-obj-preview-text" style="color:var(--text-dim);font-style:italic;">Nenhum objetivo registrado até o momento pela equipe.</div>`;
          }
          return `
            <div style="display:flex;flex-direction:column;gap:0.6rem;margin-top:0.35rem;">
              <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #0891b2;border-radius:6px;padding:0.65rem 0.85rem;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                <div style="font-size:0.75rem;font-weight:800;color:#0369a1;text-transform:uppercase;margin-bottom:0.25rem;">
                  <i class="fa-solid fa-bullseye"></i> Objetivo Geral
                </div>
                <div style="font-size:0.85rem;color:#0f172a;line-height:1.5;font-weight:450;">${escapeHtml(decomposto.geral || 'Não informado')}</div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:0.5rem;">
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #0284c7;border-radius:6px;padding:0.55rem 0.7rem;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                  <strong style="font-size:0.71rem;font-weight:800;color:#0369a1;text-transform:uppercase;display:block;margin-bottom:0.2rem;">Degrau 1 • Requisitos</strong>
                  <div style="font-size:0.8rem;color:${esp[0] ? '#0f172a' : '#64748b'};font-style:${esp[0] ? 'normal' : 'italic'};line-height:1.4;font-weight:${esp[0] ? '450' : '400'};">${escapeHtml(esp[0] || 'Pendente de preenchimento')}</div>
                </div>
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #7c3aed;border-radius:6px;padding:0.55rem 0.7rem;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                  <strong style="font-size:0.71rem;font-weight:800;color:#6d28d9;text-transform:uppercase;display:block;margin-bottom:0.2rem;">Degrau 2 • Modelagem</strong>
                  <div style="font-size:0.8rem;color:${esp[1] ? '#0f172a' : '#64748b'};font-style:${esp[1] ? 'normal' : 'italic'};line-height:1.4;font-weight:${esp[1] ? '450' : '400'};">${escapeHtml(esp[1] || 'Pendente de preenchimento')}</div>
                </div>
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #16a34a;border-radius:6px;padding:0.55rem 0.7rem;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                  <strong style="font-size:0.71rem;font-weight:800;color:#15803d;text-transform:uppercase;display:block;margin-bottom:0.2rem;">Degrau 3 • Código/Git</strong>
                  <div style="font-size:0.8rem;color:${esp[2] ? '#0f172a' : '#64748b'};font-style:${esp[2] ? 'normal' : 'italic'};line-height:1.4;font-weight:${esp[2] ? '450' : '400'};">${escapeHtml(esp[2] || 'Pendente de preenchimento')}</div>
                </div>
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #d97706;border-radius:6px;padding:0.55rem 0.7rem;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                  <strong style="font-size:0.71rem;font-weight:800;color:#b45309;text-transform:uppercase;display:block;margin-bottom:0.2rem;">Degrau 4 • Validação</strong>
                  <div style="font-size:0.8rem;color:${esp[3] ? '#0f172a' : '#64748b'};font-style:${esp[3] ? 'normal' : 'italic'};line-height:1.4;font-weight:${esp[3] ? '450' : '400'};">${escapeHtml(esp[3] || 'Pendente de preenchimento')}</div>
                </div>
              </div>
            </div>
          `;
        })()}
      </div>

      <form id="pi1-form-avaliar-objetivos" class="pi1-modal-form">
        <!-- BLOCO 1: OBJETIVO GERAL -->
        <div class="pi1-rubrica-section">
          <div class="pi1-rubrica-header">
            <h3><i class="fa-solid fa-bullseye" style="color:var(--accent-cyan);"></i> 1. Objetivo Geral (A Grande Meta)</h3>
            <select id="pi1-eval-geral-status" class="pi1-status-select" style="font-weight:700;">
              <option value="conforme" ${crit.geral_status === 'conforme' ? 'selected' : ''}>✔️ Conforme / Aprovado</option>
              <option value="ajustar" ${crit.geral_status === 'ajustar' ? 'selected' : ''}>⚠️ Requer Ajustes</option>
              <option value="ausente" ${crit.geral_status === 'ausente' ? 'selected' : ''}>❌ Não Elaborado / Ausente</option>
            </select>
          </div>
          <p style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.75rem;">
            Fórmula Roteiro 1: <code>[Verbo de Ação] + [O que será criado] + [Público/Contexto] + [Propósito/Benefício]</code>
          </p>
          <div class="pi1-checklist-grid">
            <label class="pi1-check-item">
              <input type="checkbox" id="crit-geral-verbo" ${crit.geral_verbo ? 'checked' : ''} />
              <span><strong>Verbo no Infinitivo:</strong> Inicia com verbo de ação técnica (Desenvolver, Criar, Implementar...)</span>
            </label>
            <label class="pi1-check-item">
              <input type="checkbox" id="crit-geral-produto" ${crit.geral_produto ? 'checked' : ''} />
              <span><strong>Entregável:</strong> Define claramente o produto de software tangível</span>
            </label>
            <label class="pi1-check-item">
              <input type="checkbox" id="crit-geral-publico" ${crit.geral_publico ? 'checked' : ''} />
              <span><strong>Público/Contexto:</strong> Delimita para quem e em qual ambiente se aplica</span>
            </label>
            <label class="pi1-check-item">
              <input type="checkbox" id="crit-geral-proposito" ${crit.geral_proposito ? 'checked' : ''} />
              <span><strong>Propósito & Impacto:</strong> Deixa claro qual problema real ou necessidade resolve</span>
            </label>
          </div>
        </div>

        <!-- BLOCO 2: OBJETIVOS ESPECÍFICOS (OS 4 DEGRAUS METODOLÓGICOS) -->
        <div class="pi1-rubrica-section">
          <div class="pi1-rubrica-header">
            <h3><i class="fa-solid fa-stairs" style="color:var(--ifsc-green);"></i> 2. Objetivos Específicos (4 Degraus Metodológicos)</h3>
            <span style="font-size:0.75rem;color:var(--text-dim);">Avalie um a um conforme o Roteiro 1</span>
          </div>
          <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);padding:0.5rem 0.75rem;border-radius:6px;font-size:0.75rem;color:var(--ifsc-red);margin-bottom:0.85rem;">
            <i class="fa-solid fa-triangle-exclamation"></i> <strong>Regra Anti-Estudo Passivo:</strong> Vetar tarefas rotineiras ("estudar JS", "ler artigos") ou administrativas ("criar grupo"). Devem ser entregas técnicas tangíveis!
          </div>

          <div class="pi1-degraus-container">
            <!-- Degrau 1 -->
            <div class="pi1-degrau-row">
              <div class="pi1-degrau-top">
                <div class="pi1-degrau-tag">
                  <span class="proj-badge" style="font-size:0.65rem;padding:0.15rem 0.4rem;">DEGRAU 1</span>
                  <span>Requisitos & Diagnóstico</span>
                </div>
                <select id="crit-esp1-status" class="pi1-status-select">
                  <option value="conforme" ${crit.esp1_status === 'conforme' ? 'selected' : ''}>✔️ Conforme</option>
                  <option value="ajustar" ${crit.esp1_status === 'ajustar' ? 'selected' : ''}>⚠️ Requer Ajustes</option>
                  <option value="ausente" ${crit.esp1_status === 'ausente' ? 'selected' : ''}>❌ Ausente</option>
                </select>
              </div>
              <div class="pi1-degrau-desc">Verbos: <em>Mapear, Identificar, Levantar, Investigar necessidades e problemas dos usuários.</em></div>
              <input type="text" id="crit-esp1-obs" placeholder="Observação/apontamento específico (opcional)" value="${escapeHtml(crit.esp1_obs || '')}" style="font-size:0.8rem;padding:0.35rem 0.6rem;" />
            </div>

            <!-- Degrau 2 -->
            <div class="pi1-degrau-row">
              <div class="pi1-degrau-top">
                <div class="pi1-degrau-tag">
                  <span class="proj-badge" style="font-size:0.65rem;padding:0.15rem 0.4rem;">DEGRAU 2</span>
                  <span>Modelagem & Design (draw.io / Wireframes)</span>
                </div>
                <select id="crit-esp2-status" class="pi1-status-select">
                  <option value="conforme" ${crit.esp2_status === 'conforme' ? 'selected' : ''}>✔️ Conforme</option>
                  <option value="ajustar" ${crit.esp2_status === 'ajustar' ? 'selected' : ''}>⚠️ Requer Ajustes</option>
                  <option value="ausente" ${crit.esp2_status === 'ausente' ? 'selected' : ''}>❌ Ausente</option>
                </select>
              </div>
              <div class="pi1-degrau-desc">Verbos: <em>Modelar arquitetura no draw.io, Prototipar wireframes de interface e fluxos.</em></div>
              <input type="text" id="crit-esp2-obs" placeholder="Observação/apontamento específico (opcional)" value="${escapeHtml(crit.esp2_obs || '')}" style="font-size:0.8rem;padding:0.35rem 0.6rem;" />
            </div>

            <!-- Degrau 3 -->
            <div class="pi1-degrau-row">
              <div class="pi1-degrau-top">
                <div class="pi1-degrau-tag">
                  <span class="proj-badge" style="font-size:0.65rem;padding:0.15rem 0.4rem;">DEGRAU 3</span>
                  <span>Implementação & Código (GitHub / Web)</span>
                </div>
                <select id="crit-esp3-status" class="pi1-status-select">
                  <option value="conforme" ${crit.esp3_status === 'conforme' ? 'selected' : ''}>✔️ Conforme</option>
                  <option value="ajustar" ${crit.esp3_status === 'ajustar' ? 'selected' : ''}>⚠️ Requer Ajustes</option>
                  <option value="ausente" ${crit.esp3_status === 'ausente' ? 'selected' : ''}>❌ Ausente</option>
                </select>
              </div>
              <div class="pi1-degrau-desc">Verbos: <em>Desenvolver aplicação web (HTML/CSS/JS), Versionar no Git/GitHub, Deploy Pages.</em></div>
              <input type="text" id="crit-esp3-obs" placeholder="Observação/apontamento específico (opcional)" value="${escapeHtml(crit.esp3_obs || '')}" style="font-size:0.8rem;padding:0.35rem 0.6rem;" />
            </div>

            <!-- Degrau 4 -->
            <div class="pi1-degrau-row">
              <div class="pi1-degrau-top">
                <div class="pi1-degrau-tag">
                  <span class="proj-badge" style="font-size:0.65rem;padding:0.15rem 0.4rem;">DEGRAU 4</span>
                  <span>Validação & Testes com Usuários</span>
                </div>
                <select id="crit-esp4-status" class="pi1-status-select">
                  <option value="conforme" ${crit.esp4_status === 'conforme' ? 'selected' : ''}>✔️ Conforme</option>
                  <option value="ajustar" ${crit.esp4_status === 'ajustar' ? 'selected' : ''}>⚠️ Requer Ajustes</option>
                  <option value="ausente" ${crit.esp4_status === 'ausente' ? 'selected' : ''}>❌ Ausente</option>
                </select>
              </div>
              <div class="pi1-degrau-desc">Verbos: <em>Validar usabilidade com usuários/turma, Testar interatividade, Coletar métricas.</em></div>
              <input type="text" id="crit-esp4-obs" placeholder="Observação/apontamento específico (opcional)" value="${escapeHtml(crit.esp4_obs || '')}" style="font-size:0.8rem;padding:0.35rem 0.6rem;" />
            </div>
          </div>
        </div>

        <!-- BLOCO 3: NOTA CONSOLIDADA & PARECER ORIENTADOR -->
        <div class="pi1-rubrica-section" style="background:var(--chip-bg);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
            <div class="pi1-form-group">
              <label>Nota Avaliativa (0,0 a 10,0) *</label>
              <input type="text" id="pi1-eval-nota" required placeholder="Ex: 9.5" value="${escapeHtml(notaAtual)}" style="font-size:1.05rem;font-weight:700;" />
            </div>
            <div class="pi1-form-group">
              <label>Parecer Geral de Conformidade *</label>
              <select id="pi1-eval-status" required style="font-weight:700;">
                <option value="aprovado" ${statusAtual === 'aprovado' ? 'selected' : ''}>🟢 Aprovado (Objetivos Conformados)</option>
                <option value="ajustar" ${statusAtual === 'ajustar' ? 'selected' : ''}>🟡 Requer Ajustes (Revisar Redação)</option>
                <option value="pendente" ${statusAtual === 'pendente' ? 'selected' : ''}>⚪ Em Elaboração / Pendente</option>
              </select>
            </div>
          </div>

          <div class="pi1-form-group">
            <label>Devolutiva Pedagógica & Parecer Docente (Visível aos Estudantes)</label>
            <textarea id="pi1-eval-parecer" rows="3" placeholder="Aponte o que o grupo acertou e exatamente o que precisa ser ajustado nos objetivos antes do próximo checkpoint...">${escapeHtml(parecerAtual)}</textarea>
            <span class="pi1-form-hint">O grupo receberá este parecer de forma transparente no card do projeto.</span>
          </div>
        </div>

        <div class="pi1-modal-footer">
          <button type="button" class="btn-detail" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn-action" style="background:var(--ifsc-green);color:#fff;" id="pi1-btn-submit-eval">
            <i class="fa-solid fa-floppy-disk"></i> Salvar Avaliação dos Objetivos
          </button>
        </div>
      </form>
    `;

    document.getElementById('pi1-form-avaliar-objetivos').onsubmit = async function (e) {
      e.preventDefault();
      var btn = document.getElementById('pi1-btn-submit-eval');
      btn.disabled = true;
      btn.innerText = 'Salvando avaliação...';

      var criteriosObj = {
        geral_status: document.getElementById('pi1-eval-geral-status').value,
        geral_verbo: document.getElementById('crit-geral-verbo').checked,
        geral_produto: document.getElementById('crit-geral-produto').checked,
        geral_publico: document.getElementById('crit-geral-publico').checked,
        geral_proposito: document.getElementById('crit-geral-proposito').checked,
        esp1_status: document.getElementById('crit-esp1-status').value,
        esp1_obs: document.getElementById('crit-esp1-obs').value.trim(),
        esp2_status: document.getElementById('crit-esp2-status').value,
        esp2_obs: document.getElementById('crit-esp2-obs').value.trim(),
        esp3_status: document.getElementById('crit-esp3-status').value,
        esp3_obs: document.getElementById('crit-esp3-obs').value.trim(),
        esp4_status: document.getElementById('crit-esp4-status').value,
        esp4_obs: document.getElementById('crit-esp4-obs').value.trim()
      };

      var payload = {
        projeto: projId,
        tipo: 'objetivos',
        nota: document.getElementById('pi1-eval-nota').value.trim(),
        status: document.getElementById('pi1-eval-status').value,
        criterios: criteriosObj,
        parecer: document.getElementById('pi1-eval-parecer').value.trim()
      };

      var res = await apiCall('salvarAvaliacao', payload);
      if (res.ok) {
        if (typeof window.showToast === 'function') {
          window.showToast('Avaliação dos objetivos salva com sucesso!');
        } else {
          alert('Avaliação dos objetivos salva com sucesso!');
        }
        if (typeof window.closeModal === 'function') window.closeModal();
        sincronizarRegistros();
      } else {
        alert('Erro ao salvar avaliação: ' + (res.erro || 'Falha na requisição'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Avaliação dos Objetivos';
      }
    };

    modal.classList.add('open');
  }

  // ============================ HOOKS DE INTERFACE ============================

  window.PI1 = {
    state: state,
    abrirModalAvanco: abrirModalAvanco,
    abrirModalEditarFicha: abrirModalEditarFicha,
    abrirModalCriarDemanda: abrirModalCriarDemanda,
    concluirDemanda: concluirDemanda,
    removerDemanda: removerDemanda,
    renderDemandasTab: renderDemandasTab,
    renderNotasTab: renderNotasTab,
    filtrarTabelaNotas: filtrarTabelaNotas,
    filtrarNotasPorStatus: filtrarNotasPorStatus,
    abrirModalSolicitarAcesso: abrirModalSolicitarAcesso,
    abrirPainelDocente: abrirPainelDocente,
    decidirAcesso: decidirAcesso,
    abrirModalDevolutiva: abrirModalDevolutiva,
    abrirModalAvaliarObjetivos: abrirModalAvaliarObjetivos,
    decomporObjetivos: decomporObjetivos,
    comporObjetivos: comporObjetivos,
    sincronizar: sincronizarRegistros,
    podeEditarProjeto: podeEditarProjeto
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarAuth);
  } else {
    inicializarAuth();
  }

})();
