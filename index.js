const express = require('express');
const cron = require('node-cron');
const { validate } = require('./src/config');
const { initSchema } = require('./src/db/schema');
const { createBot } = require('./src/bot/index');
const { router: sepayRouter, setBotInstance } = require('./src/webhook/sepay');
const { cancelExpiredDeposits } = require('./src/services/order');
const { config } = require('./src/config');

async function main() {
  validate();
  initSchema();

  const bot = createBot();

  // Set bot instance cho cả webhook và broadcast trước khi launch
  setBotInstance(bot);

  const app = express();
  app.use(express.json());
  app.use('/webhook', sepayRouter);
  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.listen(config.server.port, () => {
    console.log(`[Server] Listening on port ${config.server.port}`);
  });

  // Cron: hết hạn deposit mỗi 5 phút
  cron.schedule('*/5 * * * *', () => {
    const expired = cancelExpiredDeposits();
    if (expired > 0) console.log(`[Cron] Expired ${expired} pending deposits`);
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
