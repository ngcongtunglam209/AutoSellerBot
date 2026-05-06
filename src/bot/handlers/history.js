const { getUserOrders } = require('../../services/order');

const STATUS_EMOJI = {
  paid: '✅',
  pending: '⏳',
  cancelled: '❌',
};

async function handleHistory(ctx) {
  const telegramId = ctx.from.id;
  const orders = getUserOrders(telegramId);

  if (orders.length === 0) {
    return ctx.reply('📋 Bạn chưa có đơn hàng nào.');
  }

  let text = `📋 *Lịch sử giao dịch (${orders.length} đơn gần nhất)*\n\n`;

  for (const o of orders) {
    const emoji = STATUS_EMOJI[o.status] || '❓';
    text += `${emoji} *#${o.id}* — ${o.amount.toLocaleString('vi-VN')}đ — ${o.status.toUpperCase()}\n`;
    text += `   📅 ${o.created_at}\n`;
    if (o.status === 'paid' && o.login) {
      text += `   🔑 Login: \`${o.login}\`\n`;
      if (o.password) text += `   🔒 Password: \`${o.password}\`\n`;
    }
    text += '\n';
  }

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = { handleHistory };
