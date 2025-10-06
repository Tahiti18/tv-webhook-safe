TradingView Webhook (Safe Relay)

Endpoints
- POST /tv/<secret>    (TradingView points here; content-type: application/json)
- GET  /health         (returns OK)

What it does
- Validates <secret> in the URL
- Parses JSON body from TradingView
- Logs it
- Optionally forwards:
  • FORWARD_WEBHOOK (raw JSON passthrough)
  • Telegram (stringified preview)

Env (Railway → Variables → Bulk Edit)
PORT=8080
TV_WEBHOOK_SECRET=your_long_random_secret
FORWARD_WEBHOOK=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

TradingView → Alert → Settings
Webhook URL:
  https://<your-railway-domain>/tv/<your_long_random_secret>
Message (JSON example):
  {
    "source":"tv",
    "symbol":"{{ticker}}",
    "price":{{close}},
    "direction":"{{strategy.order.action}}",
    "note":"{{alert_message}}"
  }
