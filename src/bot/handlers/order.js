const { Markup } = require('telegraf');
const { getAccountById, getAvailableAccounts } = require('../../services/inventory');
const { createOrderFromBalance, createBulkOrderFromBalance } = require('../../services/order');
const { getBalance } = require('../../services/wallet');
const { config } = require('../../config');
const { safeMd } = require('../../utils/escape');

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
    (account.note ? `📝 ${safeMd(account.note)}\n` : '') +
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
    `🔑 Login: \`${safeMd(account.login)}\`\n` +
    `🔒 Password: \`${safeMd(account.password)}\`\n` +
    (account.note ? `📝 Ghi chú: ${safeMd(account.note)}\n` : '') +
    `\n💳 Số dư còn lại: *${newBalance.toLocaleString('vi-VN')}đ*`,
    { parse_mode: 'Markdown' }
  );

  // Hướng dẫn sử dụng sau khi mua
  await ctx.reply(
    `ℹ️ *Hướng dẫn sử dụng tài khoản*\n\n` +
    `1️⃣ Sao chép Login và Password ở trên\n` +
    `2️⃣ Truy cập trang đăng nhập của dịch vụ\n` +
    `3️⃣ Nhập Login + Password để đăng nhập\n` +
    `4️⃣ Đổi mật khẩu ngay sau khi đăng nhập\n\n` +
    `📍 Bạn có thể xem lại thông tin đại lý trong *Lịch Sử Mua Hàng*\n\n` +
    `⚠️ *Lưu ý:* Không có chính sách hoàn tiền sau khi đã có thông tin tài khoản.\n` +
    `📞 Hỗ trợ vấn đề kỹ thuật: /help`,
    { parse_mode: 'Markdown' }
  );

  await notifyAdmins(
    `🛒 *ĐƠN HÀNG MỚI #${orderId}*\n\n` +
    `👤 Khách: ${safeMd(username)}\n` +
    `🔑 Account: \`${safeMd(account.login)}\`\n` +
    `💰 Giá: *${account.price.toLocaleString('vi-VN')}đ*\n` +
    `💳 Số dư còn lại của khách: ${newBalance.toLocaleString('vi-VN')}đ`
  );

  // Notify admin nếu kho hết hàng
  const { countAvailable } = require('../../services/inventory');
  if (countAvailable() === 0) {
    await notifyAdmins(`⚠️ *CẢNH BÁO: KHO ĐÃ HẾT HÀNG!*\n\nVừa bán xong đơn #${orderId}. Kho hiện không còn tài khoản nào. Vui lòng nhập thêm hàng!`);
  }
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

  // Tính chiết khấu theo bậc
  const { tiers } = config.discount;
  const matchedTier = (tiers || []).find(t => qty > t.minQty) || null;
  const discountPercent = matchedTier ? matchedTier.percent : 0;
  const discountTotal = Math.round(totalOriginal * discountPercent / 100);
  const totalPrice = totalOriginal - discountTotal;

  const balance = getBalance(telegramId);
  const lack = totalPrice - balance;

  let priceText =
    `💰 Tổng giá gốc: *${totalOriginal.toLocaleString('vi-VN')}đ*\n`;
  if (discountTotal > 0) {
    priceText +=
      `🎁 Chiết khấu (mua >${matchedTier.minQty} sp → giảm ${discountPercent}%): *-${discountTotal.toLocaleString('vi-VN')}đ*\n` +
      `✨ Giá sau chiết khấu: *${totalPrice.toLocaleString('vi-VN')}đ*\n`;
  }
  priceText += `💳 Số dư của bạn: *${balance.toLocaleString('vi-VN')}đ*\n`;
  priceText += (lack > 0 ? `⚠️ Thiếu: *${lack.toLocaleString('vi-VN')}đ*` : `✅ Số dư đủ`);

  // Hiển thị bảng các mức chiết khấu hiện có (sắp xếp tăng dần để dễ đọc)
  let tierInfo = '';
  if (tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    tierInfo = `\n📊 *Bảng chiết khấu:*\n` +
      sorted.map(t =>
        `${matchedTier && qty > t.minQty && t.minQty === matchedTier.minQty ? '✅' : '•'} Mua >${t.minQty} sp: giảm *${t.percent}%*`
      ).join('\n') + '\n';
  }

  await ctx.reply(
    `📦 *Xác nhận mua ${qty} tài khoản*\n\n` + tierInfo + priceText,
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

  const { orders, totalPrice, totalOriginal, discountTotal, discountPercent } = result;
  const newBalance = getBalance(telegramId);
  const username = ctx.from.username ? `@${ctx.from.username}` : `#${telegramId}`;

  let replyText = `✅ *Mua ${orders.length} tài khoản thành công!*\n\n📦 *Danh sách tài khoản:*\n`;
  for (const { orderId, account } of orders) {
    replyText += `\n*— Đơn #${orderId} —*\n`;
    replyText += `🔑 Login: \`${safeMd(account.login)}\`\n`;
    replyText += `🔒 Password: \`${safeMd(account.password)}\`\n`;
    if (account.note) replyText += `📝 ${safeMd(account.note)}\n`;
  }
  replyText += `\n💰 Giá gốc: *${totalOriginal.toLocaleString('vi-VN')}đ*\n`;
  if (discountTotal > 0) {
    replyText += `🎁 Chiết khấu (${discountPercent}%): *-${discountTotal.toLocaleString('vi-VN')}đ*\n`;
    replyText += `✨ Thực trả: *${totalPrice.toLocaleString('vi-VN')}đ*\n`;
  } else {
    replyText += `💰 Tổng đã thanh toán: *${totalPrice.toLocaleString('vi-VN')}đ*\n`;
  }
  replyText += `💳 Số dư còn lại: *${newBalance.toLocaleString('vi-VN')}đ*`;

  await ctx.reply(replyText, { parse_mode: 'Markdown' });

  // Hướng dẫn sử dụng sau khi mua bulk
  await ctx.reply(
    `ℹ️ *Hướng dẫn sử dụng tài khoản*\n\n` +
    `1️⃣ Sao chép Login và Password tương ứng cho từng tài khoản\n` +
    `2️⃣ Truy cập trang đăng nhập của dịch vụ\n` +
    `3️⃣ Nhập Login + Password để đăng nhập\n` +
    `4️⃣ Đổi mật khẩu ngay sau khi đăng nhập để bảo mật\n\n` +
    `📍 Bạn có thể xem lại thông tin trong *Lịch Sử Mua Hàng*\n\n` +
    `⚠️ *Lưu ý:* Không có chính sách hoàn tiền sau khi đã có thông tin tài khoản.\n` +
    `📞 Hỗ trợ vấn đề kỹ thuật: /help`,
    { parse_mode: 'Markdown' }
  );

  await notifyAdmins(
    `🛒 *ĐƠN HÀNG MỚI (x${orders.length}) — ${safeMd(username)}*\n\n` +
    orders.map(({ orderId, account }) =>
      `#${orderId}: \`${safeMd(account.login)}\` — ${account.price.toLocaleString('vi-VN')}đ`
    ).join('\n') +
    `\n\n💰 Giá gốc: *${totalOriginal.toLocaleString('vi-VN')}đ*` +
    (discountTotal > 0
      ? `\n🎁 Chiết khấu (${discountPercent}%): *-${discountTotal.toLocaleString('vi-VN')}đ*\n✨ Thực thu: *${totalPrice.toLocaleString('vi-VN')}đ*`
      : `\n💰 Tổng: *${totalPrice.toLocaleString('vi-VN')}đ*`) +
    `\n💳 Số dư còn lại của khách: ${newBalance.toLocaleString('vi-VN')}đ`
  );

  // Notify admin nếu kho hết hàng
  const { countAvailable } = require('../../services/inventory');
  if (countAvailable() === 0) {
    const lastOrderId = orders[orders.length - 1]?.orderId;
    await notifyAdmins(`⚠️ *CẢNH BÁO: KHO ĐÃ HẾT HÀNG!*\n\nVừa bán xong đơn bulk (đơn cuối #${lastOrderId}). Kho hiện không còn tài khoản nào. Vui lòng nhập thêm hàng!`);
  }
}

async function handleCancelBuy(ctx) {
  await ctx.answerCbQuery('Đã huỷ').catch(() => {});
  await ctx.deleteMessage().catch(() => {}); // bỏ qua nếu tin nhắn đã bị xóa/hết hạn
}

module.exports = { handleConfirmBuy, handleDoBuy, handleCancelBuy, handleConfirmBulkBuy, handleDoBuyBulk, setOrderBot };
