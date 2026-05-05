const { Markup } = require('telegraf');
const { getAccountById, getAvailableAccounts } = require('../../services/inventory');
const { createOrderFromBalance, createBulkOrderFromBalance } = require('../../services/order');
const { getBalance } = require('../../services/wallet');
const { config } = require('../../config');

let botInstance = null;
function setOrderBot(bot) { botInstance = bot; }

async function notifyAdmins(message) {
  if (!botInstance) return;
  for (const adminId of config.bot.adminIds) {
    await botInstance.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' }).catch(() => {});
  }
}

async function handleConfirmBuy(ctx) {
  const accountId = parseInt(ctx.match[1]);
  const telegramId = ctx.from.id;

  const account = getAccountById(accountId);
  if (!account || account.status !== 'available') {
    await ctx.answerCbQuery('❌ Tài khoản này đã bán!');
    return;
  }

  await ctx.answerCbQuery();

  const balance = getBalance(telegramId);
  const lack = account.price - balance;

  await ctx.reply(
    `📦 *Xác nhận mua hàng*\n\n` +
    (account.note ? `📝 ${account.note}\n` : '') +
    `💰 Giá: *${account.price.toLocaleString('vi-VN')}đ*\n` +
    `💳 Số dư của bạn: *${balance.toLocaleString('vi-VN')}đ*\n` +
    (lack > 0 ? `⚠️ Thiếu: *${lack.toLocaleString('vi-VN')}đ*` : `✅ Số dư đủ`),
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(
        lack > 0
          ? [[Markup.button.callback('💳 Nạp thêm tiền', 'deposit_start')],
             [Markup.button.callback('❌ Huỷ', 'cancel_buy')]]
          : [[Markup.button.callback('✅ Mua ngay', `do_buy:${accountId}`)],
             [Markup.button.callback('❌ Huỷ', 'cancel_buy')]]
      ),
    }
  );
}

async function handleDoBuy(ctx) {
  const accountId = parseInt(ctx.match[1]);
  const telegramId = ctx.from.id;

  await ctx.answerCbQuery('Đang xử lý...');

  let result;
  try {
    result = createOrderFromBalance({ telegramId, accountId });
  } catch (err) {
    if (err.message === 'ACCOUNT_TAKEN') {
      return ctx.reply('❌ Tài khoản này vừa được người khác mua. Vui lòng chọn tài khoản khác!');
    }
    if (err.message === 'INSUFFICIENT_BALANCE') {
      const balance = getBalance(telegramId);
      return ctx.reply(
        `❌ Số dư không đủ.\n💳 Số dư hiện tại: *${balance.toLocaleString('vi-VN')}đ*\n\nNạp thêm tiền để tiếp tục.`,
        { parse_mode: 'Markdown' }
      );
    }
    return ctx.reply('❌ Lỗi: ' + err.message);
  }

  const { account, orderId } = result;
  const newBalance = getBalance(telegramId);
  const username = ctx.from.username ? `@${ctx.from.username}` : `#${telegramId}`;

  await ctx.reply(
    `✅ *Mua hàng thành công! #${orderId}*\n\n` +
    `📦 *Thông tin tài khoản:*\n` +
    `🔑 Login: \`${account.login}\`\n` +
    `🔒 Password: \`${account.password}\`\n` +
    (account.note ? `📝 Ghi chú: ${account.note}\n` : '') +
    `\n💳 Số dư còn lại: *${newBalance.toLocaleString('vi-VN')}đ*`,
    { parse_mode: 'Markdown' }
  );

  await notifyAdmins(
    `🛒 *ĐƠN HÀNG MỚI #${orderId}*\n\n` +
    `👤 Khách: ${username}\n` +
    `🔑 Account: \`${account.login}\`\n` +
    `💰 Giá: *${account.price.toLocaleString('vi-VN')}đ*\n` +
    `💳 Số dư còn lại của khách: ${newBalance.toLocaleString('vi-VN')}đ`
  );
}

async function handleConfirmBulkBuy(ctx) {
  const qty = parseInt(ctx.match[1]);
  const telegramId = ctx.from.id;

  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const accounts = getAvailableAccounts();

  if (accounts.length === 0) {
    return ctx.reply('😔 Kho hàng đã hết!');
  }

  const selected = accounts.slice(0, qty);
  if (selected.length < qty) {
    return ctx.reply(
      `⚠️ Kho chỉ còn *${selected.length} tài khoản*, không đủ *${qty}*.\n\nVui lòng chọn số lượng nhỏ hơn.`,
      { parse_mode: 'Markdown' }
    );
  }

  const totalOriginal = selected.reduce((sum, a) => sum + a.price, 0);
  const { minQty, discountPerItem } = config.discount;
  const discountTotal = (qty > minQty && discountPerItem > 0)
    ? discountPerItem * qty
    : 0;
  const totalPrice = totalOriginal - discountTotal;

  const balance = getBalance(telegramId);
  const lack = totalPrice - balance;

  let priceText =
    `💰 Tổng giá gốc: *${totalOriginal.toLocaleString('vi-VN')}đ*\n`;
  if (discountTotal > 0) {
    priceText +=
      `🎁 Chiết khấu mua nhiều (>${minQty} sp): *-${discountTotal.toLocaleString('vi-VN')}đ*\n` +
      `✨ Giá sau chiết khấu: *${totalPrice.toLocaleString('vi-VN')}đ*\n`;
  }
  priceText += `💳 Số dư của bạn: *${balance.toLocaleString('vi-VN')}đ*\n`;
  priceText += (lack > 0 ? `⚠️ Thiếu: *${lack.toLocaleString('vi-VN')}đ*` : `✅ Số dư đủ`);

  await ctx.reply(
    `📦 *Xác nhận mua ${qty} tài khoản*\n\n` + priceText,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(
        lack > 0
          ? [[Markup.button.callback('💳 Nạp thêm tiền', 'deposit_start')],
             [Markup.button.callback('❌ Huỷ', 'cancel_buy')]]
          : [[Markup.button.callback(`✅ Mua ${qty} tài khoản ngay`, `do_bulk:${qty}`)],
             [Markup.button.callback('❌ Huỷ', 'cancel_buy')]]
      ),
    }
  );
}

async function handleDoBuyBulk(ctx) {
  const qty = parseInt(ctx.match[1]);
  const telegramId = ctx.from.id;

  await ctx.answerCbQuery('Đang xử lý...');

  let result;
  try {
    result = createBulkOrderFromBalance({ telegramId, quantity: qty });
  } catch (err) {
    if (err.message === 'OUT_OF_STOCK') {
      return ctx.reply('❌ Kho hàng đã hết!');
    }
    if (err.message.startsWith('NOT_ENOUGH:')) {
      const available = err.message.split(':')[1];
      return ctx.reply(
        `❌ Kho chỉ còn *${available} tài khoản*, không đủ *${qty}*.\n\nVui lòng mua lại với số lượng ít hơn.`,
        { parse_mode: 'Markdown' }
      );
    }
    if (err.message === 'INSUFFICIENT_BALANCE') {
      const balance = getBalance(telegramId);
      return ctx.reply(
        `❌ Số dư không đủ.\n💳 Số dư hiện tại: *${balance.toLocaleString('vi-VN')}đ*\n\nNạp thêm tiền để tiếp tục.`,
        { parse_mode: 'Markdown' }
      );
    }
    return ctx.reply('❌ Lỗi: ' + err.message);
  }

  const { orders, totalPrice, totalOriginal, discountTotal } = result;
  const newBalance = getBalance(telegramId);
  const username = ctx.from.username ? `@${ctx.from.username}` : `#${telegramId}`;

  let replyText = `✅ *Mua ${orders.length} tài khoản thành công!*\n\n📦 *Danh sách tài khoản:*\n`;
  for (const { orderId, account } of orders) {
    replyText += `\n*— Đơn #${orderId} —*\n`;
    replyText += `🔑 Login: \`${account.login}\`\n`;
    replyText += `🔒 Password: \`${account.password}\`\n`;
    if (account.note) replyText += `📝 ${account.note}\n`;
  }
  replyText += `\n💰 Giá gốc: *${totalOriginal.toLocaleString('vi-VN')}đ*\n`;
  if (discountTotal > 0) {
    replyText += `🎁 Chiết khấu: *-${discountTotal.toLocaleString('vi-VN')}đ*\n`;
    replyText += `✨ Thực trả: *${totalPrice.toLocaleString('vi-VN')}đ*\n`;
  } else {
    replyText += `💰 Tổng đã thanh toán: *${totalPrice.toLocaleString('vi-VN')}đ*\n`;
  }
  replyText += `💳 Số dư còn lại: *${newBalance.toLocaleString('vi-VN')}đ*`;

  await ctx.reply(replyText, { parse_mode: 'Markdown' });

  await notifyAdmins(
    `🛒 *ĐƠN HÀNG MỚI (x${orders.length}) — ${username}*\n\n` +
    orders.map(({ orderId, account }) =>
      `#${orderId}: \`${account.login}\` — ${account.price.toLocaleString('vi-VN')}đ`
    ).join('\n') +
    `\n\n💰 Giá gốc: *${totalOriginal.toLocaleString('vi-VN')}đ*` +
    (discountTotal > 0 ? `\n🎁 Chiết khấu: *-${discountTotal.toLocaleString('vi-VN')}đ*\n✨ Thực thu: *${totalPrice.toLocaleString('vi-VN')}đ*` : `\n💰 Tổng: *${totalPrice.toLocaleString('vi-VN')}đ*`) +
    `\n💳 Số dư còn lại của khách: ${newBalance.toLocaleString('vi-VN')}đ`
  );
}

async function handleCancelBuy(ctx) {
  await ctx.answerCbQuery('Đã huỷ');
  await ctx.deleteMessage();
}

module.exports = { handleConfirmBuy, handleDoBuy, handleCancelBuy, handleConfirmBulkBuy, handleDoBuyBulk, setOrderBot };
