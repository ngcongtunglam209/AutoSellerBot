const { Markup } = require('telegraf');
const { getAccountById } = require('../../services/inventory');
const { createOrder, getOrderById } = require('../../services/order');
const { config } = require('../../config');

async function handleConfirmBuy(ctx) {
  const accountId = parseInt(ctx.match[1]);
  const telegramId = ctx.from.id;

  const account = getAccountById(accountId);
  if (!account || account.status !== 'available') {
    await ctx.answerCbQuery('❌ Tài khoản này đã bán!');
    return;
  }

  await ctx.answerCbQuery();

  let order;
  try {
    order = createOrder({ telegramId, accountId, amount: account.price });
  } catch (err) {
    if (err.message === 'ACCOUNT_TAKEN') {
      return ctx.reply('❌ Tài khoản này vừa được người khác mua. Vui lòng chọn tài khoản khác!');
    }
    return ctx.reply('❌ Lỗi tạo đơn hàng: ' + err.message);
  }

  const { accountNumber, bankCode, accountName } = config.sepay;
  const vietQRUrl =
    `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png` +
    `?amount=${account.price}` +
    `&addInfo=${encodeURIComponent(order.transferContent)}` +
    `&accountName=${encodeURIComponent(accountName)}`;

  const msg =
    `🧾 *ĐƠN HÀNG #${order.orderId}*\n\n` +
    `💰 Số tiền: *${account.price.toLocaleString('vi-VN')}đ*\n` +
    `🏦 Ngân hàng: *${bankCode}*\n` +
    `💳 Số TK: \`${accountNumber}\`\n` +
    `👤 Tên TK: ${accountName}\n` +
    `📝 Nội dung CK: \`${order.transferContent}\`\n\n` +
    `⏰ Hết hạn sau: *${config.order.expiryMinutes} phút*\n\n` +
    `⚠️ *Lưu ý:* Nhập ĐÚNG nội dung chuyển khoản để hệ thống xác nhận tự động.`;

  await ctx.replyWithPhoto(
    { url: vietQRUrl },
    {
      caption: msg,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Kiểm tra thanh toán', `check_payment:${order.orderId}`)],
      ]),
    }
  );
}

async function handleCheckPayment(ctx) {
  const orderId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery('Đang kiểm tra...');

  const order = getOrderById(orderId);
  if (!order) return ctx.reply('❌ Không tìm thấy đơn hàng.');

  if (order.status === 'paid') {
    await ctx.reply(
      `✅ *Đã thanh toán thành công!*\n\n` +
      `🔑 Login: \`${order.login}\`\n` +
      `🔒 Password: \`${order.password}\`\n` +
      (order.note ? `📝 Ghi chú: ${order.note}\n` : ''),
      { parse_mode: 'Markdown' }
    );
  } else if (order.status === 'cancelled') {
    await ctx.reply('❌ Đơn hàng đã hết hạn hoặc bị huỷ.');
  } else {
    await ctx.reply(
      `⏳ Chưa nhận được thanh toán.\n\n` +
      `Nội dung CK: \`${order.transfer_content}\`\n` +
      `Số tiền: *${order.amount.toLocaleString('vi-VN')}đ*\n\n` +
      `Vui lòng chuyển khoản và chờ hệ thống xác nhận tự động.`,
      { parse_mode: 'Markdown' }
    );
  }
}

module.exports = { handleConfirmBuy, handleCheckPayment };

