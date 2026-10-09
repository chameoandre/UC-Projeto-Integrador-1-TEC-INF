# Implantação do Backend Apps Script (PI-1)

Instruções passo a passo para colocar o backend do dashboard de **Projeto Integrador I** no ar com autenticação Google OAuth e notificações por e-mail.

---

## 1. Criar o Projeto no Google Apps Script

1. Abra o [Google Apps Script](https://script.google.com/home) logado na sua conta Google institucional (`andre.moraes@ifsc.edu.br` ou `chameoandre@gmail.com`).
2. Clique em **Novo projeto** e nomeie como `PI1-2026-2-Backend`.
3. Substitua o conteúdo do arquivo `Código.gs` pelo conteúdo de [`apps-script/Code.gs`](file:///Users/chameoandre/Google-Drive-chameoandre/INSTITUTO-FEDERAL-SANTA-CATARINA/CURSOS/TECNICO/informatica-integrado/unidades-curriculares/uc-projeto-integrador-1/apps-script/Code.gs).

---

## 2. Executar a Instalação Inicial

1. No menu superior do editor, selecione a função **`instalar`** e clique em **Executar**.
2. O Google solicitará permissões de acesso ao Google Planilhas e Gmail (para notificações). Conceda a autorização.
3. A função criará automaticamente a planilha privada `PI1-2026-2 — controle de acessos e registros (PRIVADO)` e registrará o docente com acesso pleno.

---

## 3. Implantar como Aplicativo da Web (Web App)

1. No canto superior direito, clique em **Implantar** > **Nova implantação**.
2. Clique no ícone de engrenagem (⚙️) ao lado de *Selecione o tipo* e escolha **App da Web**.
3. Preencha as configurações:
   - **Descrição:** `Versão 1.0 - PI1 Live & E-mails`
   - **Executar como:** `Eu (seu-email@...)`
   - **Quem pode acessar:** `Qualquer pessoa` *(essencial para requisições do GitHub Pages)*
4. Clique em **Implantar**.
5. Copie a **URL do app da web** gerada (termina em `/exec`).

---

## 4. Configurar no Dashboard

1. Abra o arquivo [`2026-2/pi1-config.js`](file:///Users/chameoandre/Google-Drive-chameoandre/INSTITUTO-FEDERAL-SANTA-CATARINA/CURSOS/TECNICO/informatica-integrado/unidades-curriculares/uc-projeto-integrador-1/2026-2/pi1-config.js).
2. Cole a URL no campo `apiUrl`:
   ```javascript
   window.PI1_CONFIG = {
     apiUrl: 'https://script.google.com/macros/s/SUA_URL_AQUI/exec',
     googleClientId: '827223670130-f312ur39hg8bamvbce5noc0iaajq8b1a.apps.googleusercontent.com',
     sheetId: '15PBDpzugjiZJsEJEcbT6CHrNGcXB_OPKdZkfsHQf9RU',
     sheetTab: 'Visao-geral',
     diasParado: 14
   };
   ```
3. Faça commit e push para o repositório no GitHub.

---

## 5. Como Funciona a Notificação por E-mail

- **Avanço / Dificuldade enviado por estudante:**
  O script envia um e-mail automático para o orientador (`andre.moraes@ifsc.edu.br`) com o relato e os bloqueios identificados.
- **Devolutiva enviada pelo docente:**
  Ao registrar a devolutiva no dashboard, o script dispara um e-mail para todos os integrantes ativos daquele projeto com as orientações do professor.
