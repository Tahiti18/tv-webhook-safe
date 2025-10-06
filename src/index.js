import 'dotenv/config';
import http from 'http';

const PORT = Number(process.env.PORT || 8080);
const SECRET = String(process.env.TV_WEBHOOK_SECRET || '').trim();
const FWD = (process.env.FORWARD_WEBHOOK || '').trim();
const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TG_CHAT = (process.env.TELEGRAM_CHAT_ID || '').trim();

function send(res, code, obj){
  const data = JSON.stringify(obj);
  res.writeHead(code, { 'content-type':'application/json' });
  res.end(data);
}

async function forwardWebhook(payload){
  if (!FWD) return;
  try {
    await fetch(FWD, { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  } catch (e) {
    console.error('[FW] error', e?.message || e);
  }
}

async function sendTelegram(text){
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }) });
  } catch (e) {
    console.error('[TG] error', e?.message || e);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health'){
      return send(res, 200, { ok:true });
    }
    if (req.method === 'POST' && req.url.startsWith('/tv/')){
      const urlSecret = decodeURIComponent(req.url.slice('/tv/'.length));
      if (!SECRET || urlSecret !== SECRET){
        return send(res, 403, { ok:false, error:'Forbidden' });
      }
      let raw = '';
      req.on('data', chunk => raw += chunk);
      req.on('end', async () => {
        let payload;
        try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw }; }
        console.log('[TV]', new Date().toISOString(), JSON.stringify(payload));
        await forwardWebhook(payload);
        await sendTelegram(`📈 TV Alert\n${JSON.stringify(payload)}`);
        send(res, 200, { ok:true });
      });
      return;
    }
    send(res, 404, { ok:false, error:'Not found' });
  } catch (e) {
    console.error('SERVER ERR', e);
    send(res, 500, { ok:false, error:'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`[boot] tv-webhook listening on :${PORT}`);
});
