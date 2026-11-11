/**
 * CIEPS Admin - envio de e-mails de /trabalhos/email
 *
 * Web App do Google Apps Script chamado por POST /api/post/trabalhos/email.
 * Os e-mails saem da conta Google que publicar este script.
 *
 * Propriedades do script (Configurações do projeto > Propriedades do script):
 *   EMAIL_SECRET  obrigatória - mesmo valor de GOOGLE_SCRIPT_EMAIL_SECRET no site
 *   SENDER_NAME   opcional    - nome exibido como remetente
 *   REPLY_TO      opcional    - endereço que recebe as respostas
 *
 * Entrada:  { secret, mensagens: [{ para, assunto, corpoHtml }] }
 * Saída:    { ok: true, resultados: [{ para, ok, erro? }], cotaRestante }
 *           { ok: false, erro }
 * Os resultados voltam na mesma ordem das mensagens recebidas.
 *
 * Confirmação automática de recebimento (ligada/desligada pelo Admin):
 *   { secret, acao: 'config', autoConfirmacao?: boolean }
 *     -> { ok: true, autoConfirmacao }
 *   { secret, acao: 'confirmacao', trabalho: { titulo, autores: [nomes], destinatarios: [e-mails] } }
 *     -> { ok: true, enviado, motivo?, cotaRestante }   (chamada pelo site dos participantes)
 */

var MAX_MENSAGENS = 200;
var MAX_ASSUNTO = 250;
var MAX_CORPO = 200000;
var NOME_PADRAO = 'Comissão Científica CIEPS';
var MAX_DESTINATARIOS_CONFIRMACAO = 30;
var ASSUNTO_CONFIRMACAO = 'Confirmação de recebimento de trabalho científico – CIEPS';
var CORPO_CONFIRMACAO = [
  '<p>Prezados(as),</p>',
  '<p>A Comissão Científica do <strong>CIEPS</strong> confirma o recebimento do trabalho científico abaixo identificado, que se encontra <strong>em processo de avaliação</strong>.</p>',
  '<p><strong>Dados do trabalho:</strong></p>',
  '<ul><li><strong>Título:</strong> {{titulo}}</li><li><strong>Autores:</strong> {{autores}}</li></ul>',
  '<p>Informamos que este e-mail tem a finalidade exclusiva de <strong>confirmar o recebimento do trabalho pela Comissão Científica</strong>, não representando aceite, aprovação ou classificação do trabalho.</p>',
  '<p>O resultado da avaliação será comunicado oportunamente pelos canais oficiais do evento.</p>',
  '<p>Em caso de dúvidas, entre em contato com a organização pelo e-mail: cientifica.vcoeps@gmail.com.</p>',
  '<p>Atenciosamente,</p>',
  '<p><strong>Comissão Científica</strong><br><strong>CIEPS</strong><br>cientifica.vcoeps@gmail.com</p>',
].join('');
var EMAIL_REGEX = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:".]{2,}$/;

function doPost(e) {
  try {
    var payload = lerPayload_(e);
    if (!payload) {
      return responder_({ ok: false, erro: 'Corpo da requisição inválido.' });
    }

    var props = PropertiesService.getScriptProperties();
    var segredo = props.getProperty('EMAIL_SECRET');
    if (!segredo) {
      return responder_({ ok: false, erro: 'EMAIL_SECRET não configurado no script.' });
    }
    if (!segredosIguais_(payload.secret, segredo)) {
      return responder_({ ok: false, erro: 'Não autorizado.' });
    }

    var opcoes = {
      nome: props.getProperty('SENDER_NAME') || NOME_PADRAO,
      responderPara: props.getProperty('REPLY_TO') || '',
    };

    if (payload.acao === 'config') {
      if (typeof payload.autoConfirmacao === 'boolean') {
        props.setProperty('AUTO_CONFIRMACAO', payload.autoConfirmacao ? 'on' : 'off');
      }
      return responder_({ ok: true, autoConfirmacao: props.getProperty('AUTO_CONFIRMACAO') === 'on' });
    }
    if (payload.acao === 'confirmacao') {
      return responder_(confirmarRecebimento_(props, payload.trabalho, opcoes));
    }

    var mensagens = payload.mensagens;
    if (!Array.isArray(mensagens) || mensagens.length === 0) {
      return responder_({ ok: false, erro: 'Nenhuma mensagem recebida.' });
    }
    if (mensagens.length > MAX_MENSAGENS) {
      return responder_({ ok: false, erro: 'Mensagens demais em uma única requisição.' });
    }

    var resultados = [];
    for (var i = 0; i < mensagens.length; i++) {
      resultados.push(enviarMensagem_(mensagens[i], opcoes));
    }

    return responder_({
      ok: true,
      resultados: resultados,
      cotaRestante: MailApp.getRemainingDailyQuota(),
    });
  } catch (erro) {
    return responder_({ ok: false, erro: 'Erro interno no script: ' + descreverErro_(erro) });
  }
}

// Só confirma que a publicação está no ar; não envia nada nem expõe dados.
function doGet() {
  return responder_({ ok: true, servico: 'cieps-trabalhos-email' });
}

/**
 * Rode esta função uma vez pelo editor antes de publicar: ela dispara a tela
 * de autorização do Google e manda um e-mail de teste para a própria conta.
 */
function testarEnvio() {
  var destino = Session.getEffectiveUser().getEmail();
  var resultado = enviarMensagem_(
    {
      para: destino,
      assunto: 'Teste do script de e-mails do CIEPS',
      corpoHtml: '<p>O script está autorizado e consegue enviar e-mails.</p>',
    },
    { nome: NOME_PADRAO, responderPara: '' }
  );
  Logger.log(JSON.stringify(resultado));
  Logger.log('Cota restante hoje: ' + MailApp.getRemainingDailyQuota());
}

// Um único e-mail por trabalho, endereçado a todos os destinatários válidos.
function confirmarRecebimento_(props, trabalho, opcoes) {
  if (props.getProperty('AUTO_CONFIRMACAO') !== 'on') {
    return { ok: true, enviado: false, motivo: 'Confirmação automática desativada.' };
  }

  var titulo = trabalho && typeof trabalho.titulo === 'string' ? trabalho.titulo.trim() : '';
  var autores = listaDeTextos_(trabalho && trabalho.autores);
  var vistos = {};
  var destinatarios = listaDeTextos_(trabalho && trabalho.destinatarios)
    .map(function (email) { return email.toLowerCase(); })
    .filter(function (email) {
      if (!EMAIL_REGEX.test(email) || vistos[email]) return false;
      vistos[email] = true;
      return true;
    })
    .slice(0, MAX_DESTINATARIOS_CONFIRMACAO);

  if (!titulo || destinatarios.length === 0) {
    return { ok: false, erro: 'Trabalho sem título ou sem destinatário válido.' };
  }
  if (MailApp.getRemainingDailyQuota() < destinatarios.length) {
    return {
      ok: true,
      enviado: false,
      motivo: 'Cota diária de envio do Google esgotada.',
      cotaRestante: MailApp.getRemainingDailyQuota(),
    };
  }

  // Função no replace para que "$" no título não seja lido como padrão especial.
  var corpoHtml = CORPO_CONFIRMACAO
    .replace('{{titulo}}', function () { return escaparHtml_(titulo); })
    .replace('{{autores}}', function () { return escaparHtml_(autores.join(', ')); });
  var email = {
    to: destinatarios.join(','),
    subject: ASSUNTO_CONFIRMACAO,
    htmlBody: corpoHtml,
    body: htmlParaTexto_(corpoHtml),
    name: opcoes.nome,
  };
  if (opcoes.responderPara) {
    email.replyTo = opcoes.responderPara;
  }
  MailApp.sendEmail(email);
  return { ok: true, enviado: true, cotaRestante: MailApp.getRemainingDailyQuota() };
}

function listaDeTextos_(valor) {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter(function (item) { return typeof item === 'string' && item.trim(); })
    .map(function (item) { return item.trim(); });
}

function escaparHtml_(texto) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function enviarMensagem_(mensagem, opcoes) {
  var para = mensagem && typeof mensagem.para === 'string' ? mensagem.para.trim().toLowerCase() : '';
  var assunto = mensagem && typeof mensagem.assunto === 'string'
    ? mensagem.assunto.replace(/[\r\n]+/g, ' ').trim()
    : '';
  var corpoHtml = mensagem && typeof mensagem.corpoHtml === 'string' ? mensagem.corpoHtml : '';

  if (!EMAIL_REGEX.test(para)) {
    return { para: para, ok: false, erro: 'Endereço de e-mail inválido.' };
  }
  if (!assunto || assunto.length > MAX_ASSUNTO) {
    return { para: para, ok: false, erro: 'Assunto ausente ou longo demais.' };
  }
  if (!corpoHtml || corpoHtml.length > MAX_CORPO) {
    return { para: para, ok: false, erro: 'Mensagem ausente ou grande demais.' };
  }
  if (MailApp.getRemainingDailyQuota() < 1) {
    return { para: para, ok: false, erro: 'Cota diária de envio do Google esgotada.' };
  }

  try {
    var email = {
      to: para,
      subject: assunto,
      htmlBody: corpoHtml,
      body: htmlParaTexto_(corpoHtml),
      name: opcoes.nome,
    };
    if (opcoes.responderPara) {
      email.replyTo = opcoes.responderPara;
    }
    MailApp.sendEmail(email);
    return { para: para, ok: true };
  } catch (erro) {
    return { para: para, ok: false, erro: descreverErro_(erro) };
  }
}

function lerPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  try {
    var payload = JSON.parse(e.postData.contents);
    return payload && typeof payload === 'object' ? payload : null;
  } catch (erro) {
    return null;
  }
}

// Compara os HMACs em vez dos textos para não vazar o segredo por tempo de resposta.
function segredosIguais_(recebido, esperado) {
  if (typeof recebido !== 'string' || !recebido) return false;
  var a = Utilities.computeHmacSha256Signature(recebido, esperado);
  var b = Utilities.computeHmacSha256Signature(esperado, esperado);
  var diferenca = 0;
  for (var i = 0; i < a.length; i++) {
    diferenca |= a[i] ^ b[i];
  }
  return diferenca === 0;
}

function htmlParaTexto_(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function descreverErro_(erro) {
  var texto = erro && erro.message ? erro.message : String(erro);
  return texto.slice(0, 200);
}

function responder_(dados) {
  return ContentService
    .createTextOutput(JSON.stringify(dados))
    .setMimeType(ContentService.MimeType.JSON);
}
