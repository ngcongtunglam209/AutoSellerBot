const express = require('express');
const router = express.Router();
const { getDepositByContent, confirmDeposit, getBalance } = require('../services/wallet');
const { config } = require('../config');
const { safeMd } = require('../utils/escape');

let botInstance = null;
let notifyAdmins = null;

function setBotInstance(bot) {
  botInstance = bot;
  // Tạo helper notify admin khi có nạp tiền
  notifyAdmins = async (msg) => {
    for (const adminId of config.bot.adminIds) {
      await bot.telegram.sendMessage(adminId, msg, { parse_mode: 'Markdown' }).catch(() => {});
    }
  };
}

router.post('/sepay', async (req, res) => {
  try {
    // Validate API key header — chặn request giả mạo
    const incomingKey = (req.headers['x-api-key'] || req.headers['authorization'] || '').replace(/^(Bearer|Apikey)\s+/i, '').trim();
    const expectedKey = config.sepay.apiKey;
    if (!incomingKey || incomingKey !== expectedKey) {
      const maskedIncoming = incomingKey ? `${incomingKey.slice(0, 4)}...${incomingKey.slice(-4)}` : '(none)';
      const maskedExpected = expectedKey ? `${expectedKey.slice(0, 4)}...${expectedKey.slice(-4)}` : '(not set)';
      console.warn(`[Webhook] Rejected request — invalid API key | got: ${maskedIncoming} | expected: ${maskedExpected}`);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { content, transferAmount, id: transactionId } = req.body;
    if (!content) return res.json({ success: false, message: 'No content' });

    const match = content.match(/SEVQR[A-Z0-9]+/);
    if (!match) return res.json({ success: false, message: 'Not a SEVQR deposit' });

    const transferContent = match[0];
    const deposit = getDepositByContent(transferContent);

    if (!deposit) return res.json({ success: false, message: 'Deposit not found' });
    if (deposit.status !== 'pending') return res.json({ success: false, message: 'Already processed' });

    const paidAmount = parseInt(transferAmount) || 0;
    if (paidAmount < deposit.amount) return res.json({ success: false, message: 'Insufficient amount' });

    confirmDeposit(deposit.id, paidAmount);

    if (botInstance && deposit.telegram_id) {
      const newBalance = getBalance(deposit.telegram_id);

      // Thông báo cho khách
      await botInstance.telegram.sendMessage(
        deposit.telegram_id,
        `✅ *Nạp tiền thành công!*\n\n` +
        `💰 Số tiền nhận: *${paidAmount.toLocaleString('vi-VN')}đ*\n` +
        `💳 Số dư hiện tại: *${newBalance.toLocaleString('vi-VN')}đ*\n` +
        `🧾 Mã GD: \`${transactionId || transferContent}\`\n\n` +
        `🛒 Nhấn /start để tiếp tục mua hàng.`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});

      // Thông báo cho admin
      if (notifyAdmins) {
        const username = safeMd(deposit.username ? `@${deposit.username}` : `#${deposit.telegram_id}`);
        await notifyAdmins(
          `💵 *KHÁCH NẠP TIỀN*\n\n` +
          `👤 Khách: ${username}\n` +
          `💰 Số tiền: *${paidAmount.toLocaleString('vi-VN')}đ*\n` +
          `💳 Số dư mới của khách: *${newBalance.toLocaleString('vi-VN')}đ*\n` +
          `🧾 Mã GD: \`${transactionId || transferContent}\``
        );
      }
    }

    console.log(`[Webhook] Deposit ${deposit.id} confirmed — ${paidAmount}đ for user ${deposit.telegram_id}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { router, setBotInstance };
