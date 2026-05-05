const { Markup } = require('telegraf');
const { getAccountById } = require('../../services/inventory');
const { createOrderFromBalance } = require('../../services/order');
const { getBalance } = require('../../services/wallet');

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

  await ctx.reply(
    `✅ *Mua hàng thành công! #${orderId}*\n\n` +
    `📦 *Thông tin tài khoản:*\n` +
    `🔑 Login: \`${account.login}\`\n` +
    `🔒 Password: \`${account.password}\`\n` +
    (account.note ? `📝 Ghi chú: ${account.note}\n` : '') +
    `\n💳 Số dư còn lại: *${newBalance.toLocaleString('vi-VN')}đ*`,
    { parse_mode: 'Markdown' }
  );
}

async function handleCancelBuy(ctx) {
  await ctx.answerCbQuery('Đã huỷ');
  await ctx.deleteMessage();
}

module.exports = { handleConfirmBuy, handleDoBuy, handleCancelBuy };
