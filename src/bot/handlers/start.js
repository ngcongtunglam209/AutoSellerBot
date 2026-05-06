const { Markup } = require('telegraf');
const { upsertUser } = require('../../services/user');
const { countAvailable } = require('../../services/inventory');
const { getBalance } = require('../../services/wallet');

// Import lazy để tránh circular dependency
function clearUserSessions(userId) {
  // Xóa session buy qty trong shop.js
  try { require('./shop').clearSession && require('./shop').clearSession(userId); } catch {}
  // Xóa session deposit trong wallet.js
  try { require('./wallet').clearSession && require('./wallet').clearSession(userId); } catch {}
}

async function handleStart(ctx) {
  const { id, username, first_name, last_name } = ctx.from;
  upsertUser({ telegramId: id, username, fullName: [first_name, last_name].filter(Boolean).join(' ') });

  // Xóa mọi session đang chờ để tránh user bị stuck
  clearUserSessions(id);

  const available = countAvailable();
  const balance = getBalance(id);

  await ctx.reply(
    `👋 *Chào mừng đến với Shop Tài Khoản!*\n\n` +
    `📦 Kho hiện có: *${available} tài khoản*\n` +
    `💳 Số dư của bạn: *${balance.toLocaleString('vi-VN')}đ*\n\n` +
    `Chọn chức năng bên dưới:`,
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['🛒 Mua Tài Khoản', '💳 Ví Của Tôi'],
        ['📋 Lịch Sử Mua Hàng', 'ℹ️ Hỗ Trợ'],
      ]).resize(),
    }
  );
}

async function handleHelp(ctx) {
  await ctx.reply(
    `ℹ️ *Hướng dẫn sử dụng:*\n\n` +
    `1. Nhấn *💳 Ví Của Tôi* → *Nạp tiền* để nạp balance\n` +
    `2. Nhấn *🛒 Mua Tài Khoản* để xem danh sách\n` +
    `3. Chọn tài khoản → Xác nhận → Nhận ngay!\n\n` +
    `💬 Liên hệ hỗ trợ: 6481038407`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = { handleStart, handleHelp };

