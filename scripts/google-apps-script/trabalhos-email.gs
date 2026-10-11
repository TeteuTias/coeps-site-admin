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
 */

var MAX_MENSAGENS = 200;
var MAX_ASSUNTO = 250;
var MAX_CORPO = 200000;
var NOME_PADRAO = 'Comissão Científica CIEPS';
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

    var mensagens = payload.mensagens;
    if (!Array.isArray(mensagens) || mensagens.length === 0) {
      return responder_({ ok: false, erro: 'Nenhuma mensagem recebida.' });
    }
    if (mensagens.length > MAX_MENSAGENS) {
      return responder_({ ok: false, erro: 'Mensagens demais em uma única requisição.' });
    }

    var opcoes = {
      nome: props.getProperty('SENDER_NAME') || NOME_PADRAO,
      responderPara: props.getProperty('REPLY_TO') || '',
    };

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
