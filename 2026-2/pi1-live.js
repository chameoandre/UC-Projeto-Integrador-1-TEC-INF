/**
 * PI-1 Live Layer — Integração OAuth Google, Registros de Avanços, Dificuldades e Devolutivas Docentes.
 * IFSC Campus Garopaba - Turma Info 2025 / 2026-2
 */

(function () {
  'use strict';

  var cfg = window.PI1_CONFIG || {};
  var state = {
    usuario: null,
    idToken: localStorage.getItem('pi1_google_token') || '',
    registros: [],
    carregando: false
  };

  // ============================ AUTENTICAÇÃO OAUTH ============================

  function inicializarAuth() {
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
    var papelTxt = state.usuario.papel === 'docente' ? 'Docente' : 'Estudante';

    authContainer.innerHTML = `
      <div class="pi1-auth-container">
        <div class="pi1-user-badge">
          <span>${escapeHtml(state.usuario.nome)}</span>
          <span class="pi1-user-role ${papelClass}">${papelTxt}</span>
        </div>
        <button class="pi1-btn-logout" id="pi1-btn-sair" title="Sair da conta">Sair</button>
      </div>
    `;

    var btnSair = document.getElementById('pi1-btn-sair');
    if (btnSair) btnSair.addEventListener('click', logout);

    if (typeof window.renderProjects === 'function') window.renderProjects();
  }

  // ============================ REGISTROS E DEVOLUTIVAS ============================

  async function sincronizarRegistros() {
    if (!cfg.apiUrl) return;
    try {
      var resp = await fetch(cfg.apiUrl);
      var data = await resp.json();
      if (data.ok && data.registros) {
        state.registros = data.registros;
        if (typeof window.renderProjects === 'function') window.renderProjects();
      }
    } catch (e) {
      console.warn('Não foi possível carregar registros ao vivo:', e);
    }
  }

  function podeEditarProjeto(projId) {
    if (!state.usuario || state.usuario.status !== 'ativo') return false;
    if (state.usuario.papel === 'docente') return true;
    var projs = state.usuario.projetos || [];
    return projs.indexOf(String(projId)) >= 0 || projs.indexOf('*') >= 0;
  }

  function abrirModalAvanco(projId) {
    if (!state.usuario) {
      alert('Faça login com sua conta Google/IFSC para registrar avanços ou dificuldades.');
      return;
    }
    if (!podeEditarProjeto(projId)) {
      alert('Você não tem permissão para editar este projeto.');
      return;
    }

    var modal = document.getElementById('projectModal');
    var modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return;

    modalContent.innerHTML = `
      <div style="margin-bottom:1rem;">
        <span class="proj-badge">PROJETO #${projId}</span>
        <h2 style="font-size:1.35rem;font-weight:700;margin-top:0.4rem;color:var(--text-main);">Registrar Avanço / Dificuldade</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;">Os dados serão sincronizados com a planilha oficial e o orientador será notificado por e-mail.</p>
      </div>
      <form id="pi1-form-registro" class="pi1-modal-form">
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

      var payload = {
        projetoId: projId,
        texto: document.getElementById('pi1-reg-texto').value.trim(),
        dificuldades: document.getElementById('pi1-reg-dificuldades').value.trim(),
        proximosPassos: document.getElementById('pi1-reg-passos').value.trim(),
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

  // ============================ HOOKS DE INTERFACE ============================

  // Expor globalmente para os botões do index.html
  window.PI1 = {
    state: state,
    abrirModalAvanco: abrirModalAvanco,
    abrirModalDevolutiva: abrirModalDevolutiva,
    sincronizar: sincronizarRegistros,
    podeEditarProjeto: podeEditarProjeto
  };

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarAuth);
  } else {
    inicializarAuth();
  }

})();
