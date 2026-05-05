const { Markup } = require('telegraf');
const { upsertUser } = require('../../services/user');
const { countAvailable } = require('../../services/inventory');

async function handleStart(ctx) {
  const { id, username, first_name, last_name } = ctx.from;
  upsertUser({
    telegramId: id,
    username: username,
    fullName: [first_name, last_name].filter(Boolean).join(' '),
  });

  const available = countAvailable();
  const welcomeText =
    `👋 *Chào mừng đến với Shop Tài Khoản!*\n\n` +
    `📦 Kho hàng hiện có: *${available} tài khoản*\n\n` +
    `Chọn chức năng bên dưới:`;

  await ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
    ...Markup.keyboard([
      ['🛒 Mua Tài Khoản'],
      ['📋 Lịch Sử Mua Hàng'],
      ['ℹ️ Hỗ Trợ'],
    ]).resize(),
  });
}

async function handleHelp(ctx) {
  await ctx.reply(
    `ℹ️ *Hướng dẫn sử dụng:*\n\n` +
    `1. Nhấn *🛒 Mua Tài Khoản* để xem danh sách\n` +
    `2. Chọn tài khoản muốn mua\n` +
    `3. Chuyển khoản theo thông tin hiển thị\n` +
    `4. Hệ thống tự động giao hàng sau khi xác nhận thanh toán\n\n` +
    `⏰ Thời gian chờ thanh toán: *15 phút*\n\n` +
    `💬 Liên hệ hỗ trợ: @admin`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = { handleStart, handleHelp };
