const express = require('express');
const router = express.Router();
const { getDepositByContent, confirmDeposit } = require('../services/wallet');

let botInstance = null;

function setBotInstance(bot) {
  botInstance = bot;
}

router.post('/sepay', async (req, res) => {
  try {
    const { content, transferAmount, id: transactionId } = req.body;
    if (!content) return res.json({ success: false, message: 'No content' });

    const napMatch = content.match(/SEVQR[A-Z0-9]+/);
    if (!napMatch) return res.json({ success: false, message: 'Not a SEVQR deposit' });

    const transferContent = napMatch[0];
    const deposit = getDepositByContent(transferContent);

    if (!deposit) return res.json({ success: false, message: 'Deposit not found' });
    if (deposit.status !== 'pending') return res.json({ success: false, message: 'Already processed' });

    const paidAmount = parseInt(transferAmount) || 0;
    if (paidAmount < deposit.amount) return res.json({ success: false, message: 'Insufficient amount' });

    const confirmed = confirmDeposit(deposit.id, paidAmount);

    if (botInstance && deposit.telegram_id) {
      const { getBalance } = require('../services/wallet');
      const newBalance = getBalance(deposit.telegram_id);
      await botInstance.telegram.sendMessage(
        deposit.telegram_id,
        `✅ *Nạp tiền thành công!*\n\n` +
        `💰 Số tiền nhận: *${paidAmount.toLocaleString('vi-VN')}đ*\n` +
        `💳 Số dư hiện tại: *${newBalance.toLocaleString('vi-VN')}đ*\n` +
        `🧾 Mã GD: \`${transactionId || transferContent}\``,
        { parse_mode: 'Markdown' }
      );
    }

    console.log(`[Webhook] Deposit ${deposit.id} confirmed — ${paidAmount}đ for user ${deposit.telegram_id}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { router, setBotInstance };

