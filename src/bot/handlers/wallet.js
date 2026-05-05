const { Markup } = require('telegraf');
const { getBalance, createDeposit, getDepositHistory } = require('../../services/wallet');
const { config } = require('../../config');

const depositSessions = new Map();

async function handleWallet(ctx) {
  const balance = getBalance(ctx.from.id);
  await ctx.reply(
    `💳 *VÍ CỦA BẠN*\n\n` +
    `💰 Số dư: *${balance.toLocaleString('vi-VN')}đ*\n\n` +
    `Chọn chức năng:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('➕ Nạp tiền', 'deposit_start')],
        [Markup.button.callback('📋 Lịch sử nạp', 'deposit_history')],
      ]),
    }
  );
}

async function handleDepositStart(ctx) {
  await ctx.answerCbQuery();
  depositSessions.set(ctx.from.id, { step: 'enter_amount' });
  await ctx.reply(
    `💰 *Nạp tiền vào ví*\n\n` +
    `Nhập số tiền muốn nạp (VNĐ):\nVí dụ: \`50000\`\n\n` +
    `Gửi /cancel để huỷ.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleDepositHistory(ctx) {
  await ctx.answerCbQuery();
  const history = getDepositHistory(ctx.from.id);
  if (history.length === 0) return ctx.reply('📋 Chưa có lịch sử nạp tiền.');

  const STATUS = { confirmed: '✅', pending: '⏳', expired: '❌' };
  let text = `📋 *Lịch sử nạp tiền*\n\n`;
  for (const d of history) {
    text += `${STATUS[d.status] || '❓'} *${d.amount.toLocaleString('vi-VN')}đ* — ${d.status.toUpperCase()}\n`;
    text += `   📅 ${d.created_at}\n`;
  }
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

async function handleDepositTextInput(ctx, next) {
  const session = depositSessions.get(ctx.from.id);
  if (!session) return next();

  const text = ctx.message.text;
  if (text === '/cancel') {
    depositSessions.delete(ctx.from.id);
    return ctx.reply('❌ Đã huỷ nạp tiền.');
  }

  const amount = parseInt(text.replace(/\D/g, ''));
  if (!amount || amount < 10000) {
    return ctx.reply('⚠️ Số tiền tối thiểu là 10,000đ. Nhập lại:');
  }

  depositSessions.delete(ctx.from.id);

  let transferContent;
  try {
    transferContent = createDeposit(ctx.from.id, amount);
  } catch (err) {
    return ctx.reply('❌ Lỗi tạo lệnh nạp: ' + err.message);
  }

  const { accountNumber, bankCode, accountName } = config.sepay;
  const vietQRUrl =
    `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png` +
    `?amount=${amount}` +
    `&addInfo=${encodeURIComponent(transferContent)}` +
    `&accountName=${encodeURIComponent(accountName)}`;

  await ctx.replyWithPhoto(
    { url: vietQRUrl },
    {
      caption:
        `🏧 *THÔNG TIN NẠP TIỀN*\n\n` +
        `💰 Số tiền: *${amount.toLocaleString('vi-VN')}đ*\n` +
        `🏦 Ngân hàng: *${bankCode}*\n` +
        `💳 Số TK: \`${accountNumber}\`\n` +
        `👤 Tên TK: ${accountName}\n` +
        `📝 Nội dung CK: \`${transferContent}\`\n\n` +
        `⏰ Hết hạn sau: *30 phút*\n\n` +
        `⚠️ Nhập ĐÚNG nội dung chuyển khoản. Hệ thống tự động cộng tiền sau khi nhận được.`,
      parse_mode: 'Markdown',
    }
  );
}

module.exports = { handleWallet, handleDepositStart, handleDepositHistory, handleDepositTextInput };
