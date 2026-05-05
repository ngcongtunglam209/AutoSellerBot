const { Markup } = require('telegraf');
const { getAvailableAccounts, getAccountById } = require('../../services/inventory');
const { upsertUser } = require('../../services/user');

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

  const keyboard = Markup.inlineKeyboard([...accountButtons, navButtons.length ? navButtons : []].filter(r => r.length));

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

async function handleBuyConfirm(ctx) {
  const accountId = parseInt(ctx.match[1]);
  const account = getAccountById(accountId);

  if (!account || account.status !== 'available') {
    await ctx.answerCbQuery('❌ Tài khoản này đã bán hoặc không tồn tại!');
    return;
  }

  await ctx.answerCbQuery();
  await ctx.reply(
    `📦 *Xác nhận mua hàng*\n\n` +
    `🆔 ID: \`${account.id}\`\n` +
    (account.note ? `📝 Ghi chú: ${account.note}\n` : '') +
    `💰 Giá: *${account.price.toLocaleString('vi-VN')}đ*\n\n` +
    `Bạn có muốn tiến hành thanh toán không?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Xác nhận mua', `confirm_buy:${accountId}`)],
        [Markup.button.callback('❌ Huỷ', 'cancel_buy')],
      ]),
    }
  );
}

async function handleCancelBuy(ctx) {
  await ctx.answerCbQuery('Đã huỷ');
  await ctx.deleteMessage();
}

module.exports = { handleShop, handleShopPage, handleBuyConfirm, handleCancelBuy };
