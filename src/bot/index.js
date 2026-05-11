const { Telegraf } = require('telegraf');
const { config } = require('../config');
const db = require('../db/index');

const NEW_BOT = '@lamtungshop_v2bot';

const REDIRECT_MESSAGE =
  `🔔 Bot này đã ngừng hoạt động!\n\n` +
  `Vui lòng chuyển sang bot mới của chúng tôi:\n` +
  `👉 ${NEW_BOT}\n\n` +
  `Cảm ơn bạn đã sử dụng dịch vụ!`;

async function broadcastMigration(bot) {
  let rows = [];
  try {
    rows = db.prepare('SELECT telegram_id FROM users').all();
  } catch (err) {
    console.error('[Broadcast] Không thể đọc danh sách user:', err.message);
    return;
  }

  console.log(`[Broadcast] Gửi thông báo di chuyển tới ${rows.length} user...`);
  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await bot.telegram.sendMessage(row.telegram_id, REDIRECT_MESSAGE);
      success++;
    } catch (err) {
      console.warn(`[Broadcast] Gửi thất bại tới ${row.telegram_id}:`, err.message);
      failed++;
    }
    // Tránh bị Telegram rate-limit
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`[Broadcast] Hoàn tất: ${success} thành công, ${failed} thất bại.`);
}

function createBot() {
  const bot = new Telegraf(config.bot.token);

  // Middleware: tất cả update đều trả về thông báo chuyển bot
  bot.use(async (ctx) => {
    try {
      await ctx.reply(REDIRECT_MESSAGE);
    } catch {
      try {
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery('Bot đã chuyển sang ' + NEW_BOT);
        }
      } catch {}
    }
  });

  bot.catch((err, ctx) => {
    console.error(`[Bot] Error for ${ctx.updateType}:`, err.message);
  });

  return bot;
}

module.exports = { createBot, broadcastMigration };
