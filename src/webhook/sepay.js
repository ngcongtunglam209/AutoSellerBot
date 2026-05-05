const express = require('express');
const router = express.Router();
const { getOrderByTransferContent, markOrderPaid } = require('../services/order');
const { markAccountSold } = require('../services/inventory');
const { config } = require('../config');

let botInstance = null;

function setBotInstance(bot) {
  botInstance = bot;
}

router.post('/sepay', async (req, res) => {
  try {
    const { content, transferAmount, id: transactionId } = req.body;

    if (!content) {
      return res.json({ success: false, message: 'No content' });
    }

    const asbMatch = content.match(/SEVQR[A-Z0-9]+/);
    if (!asbMatch) {
      return res.json({ success: false, message: 'Not a SEVQR order' });
    }

    const transferContent = asbMatch[0];
    const order = getOrderByTransferContent(transferContent);

    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.json({ success: false, message: `Order already ${order.status}` });
    }

    const paidAmount = parseInt(transferAmount) || 0;
    if (paidAmount < order.amount) {
      return res.json({ success: false, message: 'Insufficient amount' });
    }

    markOrderPaid(order.id);
    if (order.account_id) markAccountSold(order.account_id);

    if (botInstance && order.telegram_id) {
      const msg =
        `✅ *Thanh toán thành công!*\n\n` +
        `📦 *Thông tin tài khoản:*\n` +
        `🔑 Login: \`${order.login}\`\n` +
        `🔒 Password: \`${order.password}\`\n` +
        (order.note ? `📝 Ghi chú: ${order.note}\n` : '') +
        `\n💰 Đã thanh toán: ${paidAmount.toLocaleString('vi-VN')}đ\n` +
        `🧾 Mã GD: \`${transactionId || transferContent}\`\n\n` +
        `Cảm ơn bạn đã mua hàng! 🎉`;

      await botInstance.telegram.sendMessage(order.telegram_id, msg, { parse_mode: 'Markdown' });
    }

    console.log(`[Webhook] Order ${order.id} paid — account delivered to ${order.telegram_id}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { router, setBotInstance };

