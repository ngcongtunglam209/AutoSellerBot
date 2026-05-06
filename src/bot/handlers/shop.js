const { Markup } = require('telegraf');
const { getAvailableAccounts } = require('../../services/inventory');
const { upsertUser } = require('../../services/user');
const { config } = require('../../config');

const buySessions = new Map();

const ITEMS_PER_PAGE = 5;

async function handleShop(ctx) {
  const { id, username, first_name, last_name } = ctx.from;
  upsertUser({ telegramId: id, username, fullName: [first_name, last_name].filter(Boolean).join(' ') });

  const accounts = getAvailableAccounts();
  if (accounts.length === 0) {
    return ctx.reply('😔 Hiện tại kho hàng đã hết. Vui lòng quay lại sau!');
  }

  await sendAccountList(ctx, accounts, 0);
}

async function sendAccountList(ctx, accounts, page) {
  const start = page * ITEMS_PER_PAGE;
  const slice = accounts.slice(start, start + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(accounts.length / ITEMS_PER_PAGE);

  let text = `🛒 *Danh sách tài khoản* (Trang ${page + 1}/${totalPages})\n`;
  text += `📦 Còn lại: *${accounts.length} tài khoản*\n\n`;

  slice.forEach((acc, i) => {
    text += `*${start + i + 1}.* ID: \`${acc.id}\` — 💰 ${acc.price.toLocaleString('vi-VN')}đ`;
    if (acc.note) text += ` — ${acc.note}`;
    text += '\n';
  });

  text += `\n👉 Nhập ID tài khoản muốn mua hoặc dùng nút bên dưới.`;

  const navButtons = [];
  if (page > 0) navButtons.push(Markup.button.callback('⬅️ Trước', `shop_page:${page - 1}`));
  if (page < totalPages - 1) navButtons.push(Markup.button.callback('Tiếp ➡️', `shop_page:${page + 1}`));

  const accountButtons = slice.map((acc) =>
    [Markup.button.callback(`#${acc.id} — ${acc.price.toLocaleString('vi-VN')}đ`, `buy:${acc.id}`)]
  );

  const bulkButton = [Markup.button.callback('🔢 Mua theo số lượng', 'buy_qty')];

  const keyboard = Markup.inlineKeyboard(
    [...accountButtons, navButtons.length ? navButtons : [], bulkButton].filter(r => r.length)
  );

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
  }
}

async function handleShopPage(ctx) {
  const page = parseInt(ctx.match[1]);
  const accounts = getAvailableAccounts();
  if (accounts.length === 0) return ctx.answerCbQuery('Hết hàng rồi!');
  await ctx.answerCbQuery();
  await sendAccountList(ctx, accounts, page);
}

async function handleBuyQuantity(ctx) {
  await ctx.answerCbQuery();
  const accounts = getAvailableAccounts();

  if (accounts.length === 0) {
    return ctx.reply('😔 Hiện tại kho hàng đã hết!');
  }

  buySessions.set(ctx.from.id, { step: 'enter_qty' });

  // Hiển thị bảng chiết khấu trước khi yêu cầu nhập số lượng
  const { tiers } = config.discount;
  let tierText = '';
  if (tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    tierText = `\n📊 *Bảng chiết khấu:*\n` +
      sorted.map(t => `  • Mua >${t.minQty} sp: giảm *${t.percent}%*`).join('\n') +
      '\n';
  }

  await ctx.reply(
    `🔢 *Mua theo số lượng*\n\n` +
    `📦 Kho còn: *${accounts.length} tài khoản*\n` +
    tierText +
    `\nNhập số lượng bạn muốn mua:\n` +
    `_(Gửi /cancel để huỷ)_`,
    { parse_mode: 'Markdown' }
  );
}

async function handleBuyQtyTextInput(ctx, next) {
  const userId = ctx.from.id;
  const session = buySessions.get(userId);
  if (!session || session.step !== 'enter_qty') return next();

  const text = ctx.message.text.trim();
  if (text === '/cancel') {
    buySessions.delete(userId);
    return ctx.reply('❌ Đã huỷ.');
  }

  const qty = parseInt(text);
  if (isNaN(qty) || qty < 1) {
    return ctx.reply('❌ Số lượng không hợp lệ. Vui lòng nhập số nguyên dương.');
  }

  const accounts = getAvailableAccounts();
  if (accounts.length === 0) {
    buySessions.delete(userId);
    return ctx.reply('😔 Kho hàng đã hết!');
  }
  if (qty > accounts.length) {
    return ctx.reply(
      `⚠️ Kho chỉ còn *${accounts.length} tài khoản*, bạn không thể mua *${qty}*.\nVui lòng nhập lại.`,
      { parse_mode: 'Markdown' }
    );
  }

  buySessions.delete(userId);

  // Giả lập callback để tái sử dụng handleConfirmBulkBuy
  ctx.match = [null, qty.toString()];
  const { handleConfirmBulkBuy } = require('./order');
  return handleConfirmBulkBuy(ctx);
}

module.exports = { handleShop, handleShopPage, handleBuyQuantity, handleBuyQtyTextInput, clearSession: (userId) => buySessions.delete(userId) };

