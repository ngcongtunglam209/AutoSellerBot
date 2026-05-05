const express = require('express');
const cron = require('node-cron');
const { validate } = require('./src/config');
const { initSchema } = require('./src/db/schema');
const { createBot } = require('./src/bot/index');
const { router: sepayRouter, setBotInstance } = require('./src/webhook/sepay');
const { cancelExpiredOrders } = require('./src/services/order');
const { config } = require('./src/config');

async function main() {
  validate();

  initSchema();

  const bot = createBot();
  setBotInstance(bot);

  const app = express();
  app.use(express.json());
  app.use('/webhook', sepayRouter);

  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.listen(config.server.port, () => {
    console.log(`[Server] Listening on port ${config.server.port}`);
  });

  cron.schedule('*/2 * * * *', () => {
    const cancelled = cancelExpiredOrders();
    if (cancelled > 0) console.log(`[Cron] Cancelled ${cancelled} expired orders`);
  });

  bot.launch({ dropPendingUpdates: true });
  console.log('[Bot] Started successfully');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('[Fatal]', err.message);
  process.exit(1);
});
