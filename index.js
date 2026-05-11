const { initSchema } = require('./src/db/schema');
const { createBot, broadcastMigration } = require('./src/bot/index');
const { validate } = require('./src/config');

async function main() {
  validate();
  initSchema();

  const bot = createBot();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  // bot.launch() không bao giờ resolve — chạy song song
  bot.launch({ dropPendingUpdates: true }).catch((err) => {
    console.error('[Bot] Launch error:', err.message);
    process.exit(1);
  });

  // Chờ bot kết nối Telegram trước khi broadcast
  await new Promise((r) => setTimeout(r, 3000));
  console.log('[Bot] Đã khởi động. Đang gửi thông báo di chuyển...');

  // Broadcast cho toàn bộ user
  await broadcastMigration(bot);
}

main().catch((err) => {
  console.error('[Fatal]', err.message);
  process.exit(1);
});
