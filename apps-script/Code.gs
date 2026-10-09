/**
 * PI-I (IFSC Garopaba) — backend do dashboard.
 *
 * O dashboard (GitHub Pages) nunca escreve na planilha diretamente. Ele envia o pedido para
 * este script junto com o token de login Google do usuário. O script confere o
 * token com o Google, descobre quem é a pessoa, verifica se ela pode mexer
 * naquele projeto e só então grava — registrando autor, data e valor anterior.
 *
 * Implantação: veja apps-script/README-IMPLANTACAO.md
 */

// ============================ CONFIGURAÇÃO ============================
var CONFIG = {
  // Planilha pública exibida pelo dashboard (aba Visao-geral).
  SHEET_ID: '15PBDpzugjiZJsEJEcbT6CHrNGcXB_OPKdZkfsHQf9RU',
  ABA_PROJETOS: 'Visao-geral',

  // ID do cliente OAuth criado no Google Cloud.
  GOOGLE_CLIENT_ID: '827223670130-f312ur39hg8bamvbce5noc0iaajq8b1a.apps.googleusercontent.com',

  // Docentes: sempre têm acesso total, mesmo antes de existir a aba "membros".
  DOCENTES: [
    'andre.moraes@ifsc.edu.br',
    'chameoandre@gmail.com'
  ],

  // Domínios que podem SOLICITAR acesso. Quem já está na aba "membros" como
  // ativo entra independentemente do domínio.
  DOMINIOS_PERMITIDOS: ['ifsc.edu.br', 'aluno.ifsc.edu.br'],

  MAX_TEXTO: 1500,
  MAX_CAMPO: 600,
  MAX_ENVIOS_POR_HORA: 12,
  AVANCOS_NA_PLANILHA: 6,   // quantos registros recentes espelhar na coluna AVANÇOS
  NOTIFICAR_EMAIL: true     // Ativar envio de e-mails em avanços e devolutivas
};

// Colunas da aba Visao-geral (1 = A).
var COL = {
  id: 1, title: 2, team: 3, objective: 4, github: 5, relatorio: 6, canva: 7, pitch: 8,
  relatedWorks: 9, exp1: 10, exp1res: 11, exp2: 12, exp2res: 13, exp3: 14, exp3res: 15,
  exp4: 16, exp4res: 17, paper1: 18, paper2: 19, paper3: 20, paper4: 21,
  advances: 22, nextSteps: 23, difficulties: 24, techs: 25, observations: 26
};
var CAMPOS_ALUNO = ['objective', 'github', 'relatorio', 'canva', 'pitch', 'relatedWorks',
  'exp1', 'exp1res', 'exp2', 'exp2res', 'exp3', 'exp3res', 'exp4', 'exp4res', 'techs'];
var CAMPOS_DOCENTE = CAMPOS_ALUNO.concat(['title', 'team', 'paper1', 'paper2', 'paper3', 'paper4', 'observations']);
var CAMPOS_URL = ['github', 'relatorio', 'canva', 'pitch'];
var TIPOS = ['avanco', 'experimento', 'artigo', 'dificuldade', 'outro'];

var CAB_MEMBROS = ['email', 'nome', 'projetos', 'papel', 'status', 'solicitado_em', 'decidido_por'];
var CAB_REGISTROS = ['id', 'data', 'projeto', 'email', 'autor', 'tipo', 'texto', 'evidencia', 'experimento',
  'proximos_passos', 'dificuldades', 'oculto', 'devolutiva', 'devolutiva_autor', 'devolutiva_data'];
var CAB_ALTERACOES = ['data', 'projeto', 'email', 'autor', 'campo', 'valor_anterior', 'valor_novo'];

// Cache em memória durante a execução
var MEMO = { controleId: null, usuario: {} };

// ============================ INSTALAÇÃO ============================

/** Rode UMA vez pelo editor (menu Executar). Cria a planilha privada de controle. */
function instalar() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CONTROLE_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('PI1-2026-2 — controle de acessos e registros (PRIVADO)');
    props.setProperty('CONTROLE_ID', ss.getId());
    MEMO.controleId = ss.getId();
  }
  var membros = garantirAba_(ss, 'membros', CAB_MEMBROS);
  garantirAba_(ss, 'registros', CAB_REGISTROS);
  garantirAba_(ss, 'alteracoes', CAB_ALTERACOES);
  var padrao = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1') || ss.getSheetByName('Planilha1');
  if (padrao && ss.getSheets().length > 1) ss.deleteSheet(padrao);

  if (membros.getLastRow() < 2) {
    var agora = new Date().toISOString();
    CONFIG.DOCENTES.forEach(function (e) {
      membros.appendRow([e, '', '*', 'docente', 'ativo', agora, 'instalação']);
    });
  }
  importarLegado_(ss);
  Logger.log('Planilha de controle pronta: ' + ss.getUrl());
  return ss.getUrl();
}

/** Guarda o texto que já estava na coluna AVANÇOS como registro "legado". */
function importarLegado_(ss) {
  var reg = ss.getSheetByName('registros');
  if (reg.getLastRow() > 1) return;
  var projetos = lerProjetos_().projetos;
  var linhas = [];
  projetos.forEach(function (p) {
    if (!p.advances) return;
    linhas.push([novoId_(), '', p.id, '', 'Planilha (anterior ao novo sistema)', 'legado',
      seguro_(p.advances), '', '', seguro_(p.nextSteps), seguro_(p.difficulties), '', '', '', '']);
  });
  if (linhas.length) reg.getRange(2, 1, linhas.length, CAB_REGISTROS.length).setValues(linhas);
}

// ============================ ROTAS HTTP ============================

function doGet(e) {
  try {
    var dados = lerProjetos_();
    var registros = lerRegistrosPublicos_();
    return json_({
      ok: true,
      atualizadoEm: dados.atualizadoEm,
      projetos: dados.projetos,
      registros: registros
    });
  } catch (err) {
    return json_({ ok: false, erro: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    var body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var acao = body.acao;
    var idToken = body.idToken;

    if (!acao) throw new Error('Ação não informada.');

    // 1. Identificar usuário via Google OAuth (Obrigatório para todas as escritas)
    var usuario = autenticar_(idToken);
    if (!usuario) throw new Error('Autenticação obrigatória. Faça login com sua conta Google/IFSC.');

    // 2. Roteamento de ações
    if (acao === 'whoami') {
      return json_({ ok: true, usuario: usuarioPrivado_(usuario) });
    }
    if (acao === 'solicitarAcesso') {
      return json_(solicitarAcesso_(usuario, body.projeto, body.nome));
    }
    if (acao === 'registrar') {
      return json_(registrarAvanco_(usuario, body));
    }
    if (acao === 'salvarDevolutiva' || acao === 'devolutiva') {
      return json_(salvarDevolutiva_(usuario, body));
    }
    if (acao === 'atualizarFicha') {
      return json_(atualizarFicha_(usuario, body));
    }
    if (acao === 'painel') {
      return json_(dadosPainelDocente_(usuario));
    }
    if (acao === 'decidirAcesso') {
      return json_(decidirAcesso_(usuario, body.email, body.decisao, body.projetos));
    }
    if (acao === 'salvarMembro') {
      return json_(salvarMembro_(usuario, body));
    }
    if (acao === 'ocultar') {
      return json_(ocultarRegistro_(usuario, body.registroId, body.oculto));
    }

    throw new Error('Ação desconhecida: ' + acao);
  } catch (err) {
    return json_({ ok: false, erro: String(err.message || err) });
  }
}

// ============================ AÇÕES DE NEGÓCIO ============================

function solicitarAcesso_(usuario, projeto, nome) {
  if (usuario.papel === 'docente') return { ok: true, mensagem: 'Você já é docente com acesso total.' };
  var projNum = Number(projeto);
  if (isNaN(projNum) || projNum < 1) throw new Error('Projeto inválido.');

  var ssControle = getControle_();
  var membrosAba = ssControle.getSheetByName('membros');
  var dados = membrosAba.getDataRange().getValues();
  var agora = new Date().toISOString();
  var nomeFinal = seguro_(nome || usuario.nome, 100);

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).toLowerCase().trim() === usuario.email) {
      if (dados[i][4] === 'ativo') {
        throw new Error('Você já possui acesso ativo ao(s) projeto(s) #' + dados[i][2]);
      }
      membrosAba.getRange(i + 1, 2).setValue(nomeFinal);
      membrosAba.getRange(i + 1, 3).setValue(String(projNum));
      membrosAba.getRange(i + 1, 5).setValue('pendente');
      membrosAba.getRange(i + 1, 6).setValue(agora);
      return { ok: true, status: 'pendente' };
    }
  }

  membrosAba.appendRow([usuario.email, nomeFinal, String(projNum), 'aluno', 'pendente', agora, '']);
  return { ok: true, status: 'pendente' };
}

function registrarAvanco_(usuario, body) {
  var projeto = Number(body.projeto || body.projetoId);
  if (!podeEscreverProjeto_(usuario, projeto)) {
    throw new Error('Você não tem permissão para registrar dados neste projeto. Aguarde aprovação docente.');
  }

  var texto = seguro_(body.texto, CONFIG.MAX_TEXTO);
  if (!texto || texto.length < 10) throw new Error('Descreva o avanço ou atividade com pelo menos 10 caracteres.');

  var tipo = TIPOS.indexOf(body.tipo) >= 0 ? body.tipo : 'avanco';
  var evidencia = urlValida_(body.evidencia);
  var proxPassos = seguro_(body.proximosPassos, CONFIG.MAX_TEXTO);
  var dificuldades = seguro_(body.dificuldades, CONFIG.MAX_TEXTO);
  var expNum = Number(body.experimento) || '';

  var id = novoId_();
  var agora = new Date().toISOString();
  var autor = formatarAutor_(usuario);

  var ssControle = getControle_();
  var regAba = ssControle.getSheetByName('registros');
  regAba.appendRow([
    id, agora, projeto, usuario.email, autor, tipo, texto, evidencia, expNum,
    proxPassos, dificuldades, '', '', '', ''
  ]);

  // Espelhar na planilha pública de projetos
  espelharNaPlanilha_(projeto, proxPassos, dificuldades);

  // Enviar notificação por e-mail aos docentes
  if (CONFIG.NOTIFICAR_EMAIL) {
    enviarEmailNotificacaoDocente_(usuario, projeto, texto, dificuldades);
  }

  return { ok: true, id: id, autor: autor, data: agora };
}

function salvarDevolutiva_(usuario, body) {
  if (usuario.papel !== 'docente') throw new Error('Apenas docentes podem registrar devolutivas.');

  var regId = String(body.registroId || '').trim();
  var textoDevolutiva = seguro_(body.devolutiva || body.texto, CONFIG.MAX_TEXTO);
  if (!regId) throw new Error('Registro não informado.');

  var ssControle = getControle_();
  var regAba = ssControle.getSheetByName('registros');
  var dados = regAba.getDataRange().getValues();
  var achou = false;
  var emailAluno = '';
  var projetoId = '';
  var textoOriginal = '';

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]) === regId) {
      regAba.getRange(i + 1, 13).setValue(textoDevolutiva);
      regAba.getRange(i + 1, 14).setValue(usuario.nome || usuario.email.split('@')[0]);
      regAba.getRange(i + 1, 15).setValue(new Date().toISOString());
      achou = true;
      emailAluno = dados[i][3];
      projetoId = dados[i][2];
      textoOriginal = dados[i][6];
      break;
    }
  }

  if (!achou) throw new Error('Registro não encontrado.');

  // Enviar e-mail de devolutiva para a equipe do projeto
  if (CONFIG.NOTIFICAR_EMAIL && textoDevolutiva) {
    enviarEmailDevolutivaAluno_(projetoId, emailAluno, textoDevolutiva, textoOriginal);
  }

  return { ok: true, registroId: regId };
}

function atualizarFicha_(usuario, body) {
  var projId = Number(body.projeto || body.projetoId);
  if (!podeEscreverProjeto_(usuario, projId)) {
    throw new Error('Você não tem permissão para editar os dados deste projeto.');
  }

  var permitidos = usuario.papel === 'docente' ? CAMPOS_DOCENTE : CAMPOS_ALUNO;
  var campos = body.campos || {};
  var ssPub = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var abaPub = ssPub.getSheetByName(CONFIG.ABA_PROJETOS) || ssPub.getSheets()[0];
  var dados = abaPub.getDataRange().getValues();

  var linha = 0;
  for (var r = 0; r < dados.length; r++) {
    if (Number(dados[r][0]) === projId) {
      linha = r + 1;
      break;
    }
  }
  if (!linha) throw new Error('Projeto não encontrado na planilha.');

  var alteracoes = [];
  var agora = new Date().toISOString();
  var ssControle = getControle_();
  var altAba = ssControle.getSheetByName('alteracoes');

  Object.keys(campos).forEach(function (campo) {
    if (permitidos.indexOf(campo) >= 0 && COL[campo]) {
      var valorAntigo = String(dados[linha - 1][COL[campo] - 1] || '');
      var novoValor = seguro_(campos[campo], CONFIG.MAX_CAMPO);
      if (CAMPOS_URL.indexOf(campo) >= 0 && novoValor) {
        novoValor = urlValida_(novoValor);
      }
      if (valorAntigo !== novoValor) {
        abaPub.getRange(linha, COL[campo]).setValue(novoValor);
        altAba.appendRow([agora, projId, usuario.email, usuario.nome, campo, valorAntigo, novoValor]);
        alteracoes.push(campo);
      }
    }
  });

  return { ok: true, alterados: alteracoes };
}

function dadosPainelDocente_(usuario) {
  if (usuario.papel !== 'docente') throw new Error('Acesso restrito a docentes.');
  var ss = getControle_();
  var membrosAba = ss.getSheetByName('membros');
  var membrosDados = membrosAba ? membrosAba.getDataRange().getValues() : [];
  var membros = [];
  for (var i = 1; i < membrosDados.length; i++) {
    membros.push({
      email: membrosDados[i][0],
      nome: membrosDados[i][1],
      projetos: String(membrosDados[i][2]),
      papel: membrosDados[i][3],
      status: membrosDados[i][4],
      solicitadoEm: membrosDados[i][5],
      decididoPor: membrosDados[i][6]
    });
  }

  var altAba = ss.getSheetByName('alteracoes');
  var altDados = altAba ? altAba.getDataRange().getValues() : [];
  var alteracoes = [];
  for (var j = Math.max(1, altDados.length - 30); j < altDados.length; j++) {
    alteracoes.push({
      data: altDados[j][0],
      projeto: altDados[j][1],
      autor: altDados[j][3],
      campo: altDados[j][4],
      de: altDados[j][5],
      para: altDados[j][6]
    });
  }

  return {
    ok: true,
    membros: membros,
    alteracoes: alteracoes.reverse(),
    planilhaControleUrl: ss.getUrl()
  };
}

function decidirAcesso_(usuario, email, decisao, projetos) {
  if (usuario.papel !== 'docente') throw new Error('Acesso restrito a docentes.');
  var ss = getControle_();
  var membrosAba = ss.getSheetByName('membros');
  var dados = membrosAba.getDataRange().getValues();
  var emailAlvo = String(email || '').toLowerCase().trim();

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).toLowerCase().trim() === emailAlvo) {
      membrosAba.getRange(i + 1, 5).setValue(decisao === 'aprovar' ? 'ativo' : 'recusado');
      if (projetos) membrosAba.getRange(i + 1, 3).setValue(String(projetos));
      membrosAba.getRange(i + 1, 7).setValue(usuario.email);
      return dadosPainelDocente_(usuario);
    }
  }
  throw new Error('Membro não encontrado.');
}

function salvarMembro_(usuario, body) {
  if (usuario.papel !== 'docente') throw new Error('Acesso restrito a docentes.');
  var email = String(body.email || '').toLowerCase().trim();
  if (!email || email.indexOf('@') < 0) throw new Error('E-mail inválido.');

  var nome = seguro_(body.nome, 100);
  var projetos = String(body.projetos || '').trim();
  var papel = body.papel === 'docente' ? 'docente' : 'aluno';
  var status = body.status === 'ativo' ? 'ativo' : (body.status === 'recusado' ? 'recusado' : 'pendente');

  var ss = getControle_();
  var membrosAba = ss.getSheetByName('membros');
  var dados = membrosAba.getDataRange().getValues();
  var agora = new Date().toISOString();

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).toLowerCase().trim() === email) {
      if (nome) membrosAba.getRange(i + 1, 2).setValue(nome);
      membrosAba.getRange(i + 1, 3).setValue(projetos || '*');
      membrosAba.getRange(i + 1, 4).setValue(papel);
      membrosAba.getRange(i + 1, 5).setValue(status);
      membrosAba.getRange(i + 1, 7).setValue(usuario.email);
      return dadosPainelDocente_(usuario);
    }
  }

  membrosAba.appendRow([email, nome, projetos || (papel === 'docente' ? '*' : '1'), papel, status, agora, usuario.email]);
  return dadosPainelDocente_(usuario);
}

function ocultarRegistro_(usuario, registroId, oculto) {
  if (usuario.papel !== 'docente') throw new Error('Acesso restrito a docentes.');
  var ss = getControle_();
  var regAba = ss.getSheetByName('registros');
  var dados = regAba.getDataRange().getValues();

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]) === String(registroId)) {
      regAba.getRange(i + 1, 12).setValue(oculto ? 'sim' : '');
      var projId = Number(dados[i][2]);
      espelharNaPlanilha_(projId);
      return { ok: true, registroId: registroId };
    }
  }
  throw new Error('Registro não encontrado.');
}

// ============================ NOTIFICAÇÕES POR E-MAIL ============================

function enviarEmailNotificacaoDocente_(usuario, projeto, texto, dificuldades) {
  try {
    var assunto = '[PI-1] Registro de Avanço / Bloqueio — Projeto #' + projeto;
    var corpo = 'Olá, Professor,\n\n' +
      'Um novo registro foi enviado pelo estudante ' + usuario.nome + ' (' + usuario.email + ') no Projeto #' + projeto + ':\n\n' +
      '• Avanço/Relato: ' + texto + '\n' +
      (dificuldades ? ('• Dificuldades/Bloqueios: ' + dificuldades + '\n') : '') +
      '\nPara responder com uma devolutiva à equipe, acesse o Dashboard:\n' +
      'https://chameoandre.github.io/UC-Projeto-Integrador-1-TEC-INF/2026-2/\n\n' +
      'Atenciosamente,\nSistema de Acompanhamento PI-1';

    CONFIG.DOCENTES.forEach(function (docEmail) {
      if (docEmail.indexOf('@') > 0) {
        GmailApp.sendEmail(docEmail, assunto, corpo);
      }
    });
  } catch (e) {
    Logger.log('Erro ao enviar e-mail docente: ' + e);
  }
}

function enviarEmailDevolutivaAluno_(projetoId, emailAluno, textoDevolutiva, textoOriginal) {
  try {
    var emailsDestino = [];
    if (emailAluno && emailAluno.indexOf('@') > 0) emailsDestino.push(emailAluno);

    // Buscar outros membros ativos do mesmo projeto
    var membros = getControle_().getSheetByName('membros').getDataRange().getValues();
    for (var i = 1; i < membros.length; i++) {
      var e = membros[i][0];
      var projs = String(membros[i][2] || '').split(',');
      var status = membros[i][4];
      if (status === 'ativo' && (projs.indexOf(String(projetoId)) >= 0 || projs.indexOf('*') >= 0)) {
        if (emailsDestino.indexOf(e) === -1 && e.indexOf('@') > 0) {
          emailsDestino.push(e);
        }
      }
    }

    if (!emailsDestino.length) return;

    var assunto = '[PI-1] Devolutiva do Orientador — Projeto #' + projetoId;
    var corpo = 'Olá, equipe do Projeto #' + projetoId + ',\n\n' +
      'O professor orientador enviou uma devolutiva sobre a atividade de vocês:\n\n' +
      '• Comentário / Devolutiva: ' + textoDevolutiva + '\n\n' +
      '• Registro original de referência: "' + textoOriginal + '"\n\n' +
      'Acompanhem os próximos passos e atualizações no Dashboard:\n' +
      'https://chameoandre.github.io/UC-Projeto-Integrador-1-TEC-INF/2026-2/\n\n' +
      'Atenciosamente,\nSecretaria Acadêmica / Docência PI-1';

    emailsDestino.forEach(function (to) {
      GmailApp.sendEmail(to, assunto, corpo);
    });
  } catch (e) {
    Logger.log('Erro ao enviar e-mail de devolutiva para aluno: ' + e);
  }
}

// ============================ UTILITÁRIOS E HELPERS ============================

function getControle_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CONTROLE_ID') || MEMO.controleId;
  if (!id) {
    instalar();
    id = props.getProperty('CONTROLE_ID');
  }
  return SpreadsheetApp.openById(id);
}

function autenticar_(idToken) {
  if (!idToken) return null;
  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return null;
  var payload = JSON.parse(resp.getContentText());
  if (payload.aud !== CONFIG.GOOGLE_CLIENT_ID) return null;

  var email = String(payload.email || '').toLowerCase().trim();
  var nome = payload.name || email.split('@')[0];

  // Verificar se é docente
  if (CONFIG.DOCENTES.indexOf(email) >= 0) {
    return { email: email, nome: nome, papel: 'docente', projetos: ['*'], status: 'ativo' };
  }

  // Verificar membro na planilha de controle
  var membros = getControle_().getSheetByName('membros').getDataRange().getValues();
  for (var i = 1; i < membros.length; i++) {
    if (String(membros[i][0]).toLowerCase().trim() === email) {
      return {
        email: email,
        nome: membros[i][1] || nome,
        projetos: String(membros[i][2]).split(',').map(function (p) { return p.trim(); }),
        papel: membros[i][3] || 'aluno',
        status: membros[i][4] || 'pendente'
      };
    }
  }

  return { email: email, nome: nome, papel: 'visitante', projetos: [], status: 'novo' };
}

function podeEscreverProjeto_(usuario, projId) {
  if (!usuario || usuario.status !== 'ativo') return false;
  if (usuario.papel === 'docente') return true;
  return usuario.projetos.indexOf(String(projId)) >= 0 || usuario.projetos.indexOf('*') >= 0;
}

function formatarAutor_(usuario) {
  var partes = (usuario.nome || usuario.email.split('@')[0]).trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return partes[0] + ' ' + partes[partes.length - 1][0] + '.';
}

function espelharNaPlanilha_(projId, proximos, dificuldades) {
  var ssPub = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var abaPub = ssPub.getSheetByName(CONFIG.ABA_PROJETOS) || ssPub.getSheets()[0];
  var dados = abaPub.getDataRange().getValues();

  var ssControle = getControle_();
  var regAba = ssControle.getSheetByName('registros');
  var regs = regAba.getDataRange().getValues();

  var ultimosAvancos = [];
  for (var i = regs.length - 1; i >= 1; i--) {
    if (Number(regs[i][2]) === projId && !regs[i][11]) {
      ultimosAvancos.push(regs[i][4] + ' (' + String(regs[i][1]).slice(0, 10) + '): ' + regs[i][6]);
      if (ultimosAvancos.length >= CONFIG.AVANCOS_NA_PLANILHA) break;
    }
  }

  for (var r = 0; r < dados.length; r++) {
    if (Number(dados[r][0]) === projId) {
      if (ultimosAvancos.length) {
        abaPub.getRange(r + 1, COL.advances).setValue(ultimosAvancos.join('\n\n'));
      }
      if (proximos) {
        abaPub.getRange(r + 1, COL.nextSteps).setValue(seguro_(proximos));
      }
      if (dificuldades) {
        abaPub.getRange(r + 1, COL.difficulties).setValue(seguro_(dificuldades));
      }
      break;
    }
  }
}

function lerProjetos_() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var aba = ss.getSheetByName(CONFIG.ABA_PROJETOS) || ss.getSheets()[0];
  var dados = aba.getDataRange().getValues();
  var projetos = [];

  for (var r = 3; r < dados.length; r++) {
    var row = dados[r];
    if (!row || !row[0] || isNaN(row[0])) continue;
    projetos.push({
      id: Number(row[COL.id - 1]),
      title: String(row[COL.title - 1] || ''),
      team: String(row[COL.team - 1] || ''),
      objective: String(row[COL.objective - 1] || ''),
      github: String(row[COL.github - 1] || ''),
      overleaf: String(row[COL.relatorio - 1] || ''),
      canva: String(row[COL.canva - 1] || ''),
      pitch: String(row[COL.pitch - 1] || ''),
      advances: String(row[COL.advances - 1] || ''),
      nextSteps: String(row[COL.nextSteps - 1] || ''),
      difficulties: String(row[COL.difficulties - 1] || '')
    });
  }

  return { atualizadoEm: new Date().toISOString(), projetos: projetos };
}

function lerRegistrosPublicos_() {
  var ss = getControle_();
  var aba = ss.getSheetByName('registros');
  if (!aba || aba.getLastRow() < 2) return [];
  var dados = aba.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < dados.length; i++) {
    if (!dados[i][11]) { // não oculto
      list.push({
        id: dados[i][0],
        data: dados[i][1],
        projeto: dados[i][2],
        autor: dados[i][4],
        tipo: dados[i][5],
        texto: dados[i][6],
        evidencia: dados[i][7],
        experimento: dados[i][8],
        proximosPassos: dados[i][9],
        dificuldades: dados[i][10],
        devolutiva: dados[i][12],
        devolutivaAutor: dados[i][13],
        devolutivaData: dados[i][14]
      });
    }
  }
  return list;
}

function garantirAba_(ss, nome, cabecalho) {
  var aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    aba.appendRow(cabecalho);
  }
  return aba;
}

function seguro_(txt, max) {
  if (!txt) return '';
  var s = String(txt).replace(/<[^>]*>/g, '').trim();
  return max ? s.slice(0, max) : s;
}

function urlValida_(u) {
  if (!u) return '';
  var s = String(u).trim();
  if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(s)) return s;
  return '';
}

function novoId_() {
  return 'R' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function usuarioPrivado_(u) {
  return { email: u.email, nome: u.nome, papel: u.papel, projetos: u.projetos, status: u.status };
}
