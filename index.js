const { initSchema } = require('./src/db/schema');
const { createBot, broadcastMigration } = require('./src/bot/index');
const { validate } = require('./src/config');

async function main() {
  validate();
  initSchema();

  const bot = createBot();

  // Khởi động bot polling
  await bot.launch({ dropPendingUpdates: true });
  console.log('[Bot] Đã khởi động. Đang gửi thông báo di chuyển...');

  // Broadcast cho toàn bộ user sau khi bot đã sẵn sàng
  await broadcastMigration(bot);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('[Fatal]', err.message);
  process.exit(1);
});
