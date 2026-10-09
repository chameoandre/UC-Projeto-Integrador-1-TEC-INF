/* Configuração do dashboard PI-I (Turma Info 2025 - 2º Ano / 2026-2).
   Os valores abaixo são públicos por natureza; nenhuma senha ou segredo fica aqui. */
window.PI1_CONFIG = {
  // URL do app da web do Apps Script (termina em /exec)
  apiUrl: 'https://script.google.com/macros/s/AKfycbz9hAeeFfpbRY6TUH0ykOQM8PAu-4OaTi8SuXkz8FR_aP_s6ZROQtaiP-c22VNxPw/exec',

  // ID do cliente OAuth do Google Cloud (termina em .apps.googleusercontent.com)
  googleClientId: '827223670130-f312ur39hg8bamvbce5noc0iaajq8b1a.apps.googleusercontent.com',

  // Planilha pública usada como reserva quando o apiUrl está vazio ou fora do ar.
  sheetId: '15PBDpzugjiZJsEJEcbT6CHrNGcXB_OPKdZkfsHQf9RU',
  sheetTab: 'Visao-geral',

  // Dias sem registro a partir dos quais um grupo aparece como "atenção"
  diasParado: 14
};
