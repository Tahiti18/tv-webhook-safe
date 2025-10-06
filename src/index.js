// src/index.js
import 'dotenv/config';
import http from 'http';
import { URL } from 'url';

const PORT     = Number(process.env.PORT || 8080);
// Secret you appended in TradingView’s Webhook URL path
// e.g. https://.../tv/<THIS_SECRET>
const SECRET   = String(process.env.TV_WEBHOOK_SECRET || '').trim();

// Optional: forward the same payload to another webhook (e.g. your worker)
const FORWARD  = String(process.env.FORWARD_WEBHOOK || '').trim();

// Optional: Telegram push
const TG_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TG_CHAT  = String(process.env.TELEGRAM_CHAT_ID || '').trim();

// ---------- helpers ----------
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(body);
}

async function forwardWebhook(payload) {
  if (!FORWARD) return;
  try {
    await fetch(FORWARD, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('[FW] error:', err?.message || err);
  }
}

async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text,
        disable_web_page_preview: true,
        parse_mode: 'Markdown'
      })
    });
  } catch (err) {
    console.error('[TG] error:', err?.message || err);
  }
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  try {
    // Basic routing
    const base = `http://${req.headers.host || 'localhost'}`;
    const url  = new URL(req.url || '/', base);

    // Health & root
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return send(res, 200, { ok: true, service: 'tv-webhook', time: new Date().toISOString() });
    }

    // TradingView posts here: /tv/<secret>
    if (req.method === 'POST' && url.pathname.startsWith('/tv/')) {
      const urlSecret = decodeURIComponent(url.pathname.slice('/tv/'.length));
      if (!SECRET || urlSecret !== SECRET) {
        return send(res, 403, { ok: false, error: 'Forbidden' });
      }

      // Read body safely (TV usually <10KB)
      let raw = '';
      let tooLarge = false;
      req.on('data', chunk => {
        raw += chunk;
        if (raw.length > 1_000_000) tooLarge = true; // 1MB safety
      });
      req.on('end', async () => {
        if (tooLarge) return send(res, 413, { ok: false, error: 'Payload too large' });

        // Try JSON parse; if not JSON, keep raw
        let payload;
        try { payload = raw ? JSON.parse(raw) : {}; }
        catch { payload = { raw }; }

        // Log a compact line (helps you trace in Railway logs)
        console.log('[TV]', new Date().toISOString(), JSON.stringify(payload));

        // Fan-out
        await forwardWebhook(payload);
        await sendTelegram(`📈 *TV Alert*\n\`\`\`\n${JSON.stringify(payload)}\n\`\`\``);

        return send(res, 200, { ok: true });
      });
      return;
    }

    // Unknown route
    return send(res, 404, { ok: false, error: 'Not found' });
  } catch (err) {
    console.error('[SERVER]', err);
    return send(res, 500, { ok: false, error: 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`[boot] tv-webhook listening on :${PORT}`);
});
