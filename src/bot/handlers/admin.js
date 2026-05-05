const { Markup } = require('telegraf');
const { config } = require('../../config');
const {
  addAccountsBulk, deleteAccount,
  getAllAccounts, countAvailable,
} = require('../../services/inventory');
const { getAllOrders, getStats } = require('../../services/order');
const { adminAdjustBalance } = require('../../services/wallet');
const { notifyAllUsers } = require('../../services/broadcast');

const adminSessions = new Map();

function isAdmin(ctx) {
  return config.bot.adminIds.includes(ctx.from.id);
}

async function handleAdmin(ctx) {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ Bạn không có quyền truy cập.');
  }

  const stats = getStats();
  const available = countAvailable();

  const text =
    `🔐 *ADMIN PANEL*\n\n` +
    `📦 Tài khoản còn: *${available}*\n` +
    `📊 Tổng đơn: *${stats.totalOrders}*\n` +
    `✅ Đơn thành công: *${stats.paidOrders}*\n` +
    `⏳ Đơn chờ: *${stats.pendingOrders}*\n` +
    `💰 Doanh thu: *${stats.totalRevenue.toLocaleString('vi-VN')}đ*`;

  const { minQty, discountPerItem } = config.discount;
  const discountInfo = discountPerItem > 0
    ? `🎁 Chiết khấu: *-${discountPerItem.toLocaleString('vi-VN')}đ/sp* khi mua *>${minQty} sp*`
    : `🎁 Chiết khấu: *Chưa bật*`;

  await ctx.reply(text + '\n' + discountInfo, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('➕ Thêm account', 'admin_add')],
      [Markup.button.callback('📦 Xem kho hàng', 'admin_inventory')],
      [Markup.button.callback('📋 Đơn hàng gần đây', 'admin_orders')],
      [Markup.button.callback('📊 Thống kê', 'admin_stats')],
      [Markup.button.callback('💳 Điều chỉnh số dư', 'admin_balance')],
      [Markup.button.callback('🎁 Cài chiết khấu số lượng', 'admin_discount')],
    ]),
  });
}

async function handleAdminAdd(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();

  adminSessions.set(ctx.from.id, { step: 'add_account' });

  await ctx.reply(
    `➕ *Thêm tài khoản vào kho*\n\n` +
    `Gửi thông tin theo định dạng:\n` +
    `\`login|password|ghi_chu|gia\`\n\n` +
    `Ví dụ:\n` +
    `\`user123|pass456|Nick đẹp|50000\`\n\n` +
    `Để thêm nhiều cùng lúc, mỗi tài khoản 1 dòng.\n` +
    `Gửi /cancel để huỷ.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleAdminInventory(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();

  const accounts = getAllAccounts();
  if (accounts.length === 0) return ctx.reply('📦 Kho trống.');

  let text = `📦 *Kho hàng (${accounts.length} tài khoản)*\n\n`;
  const slice = accounts.slice(0, 20);
  for (const acc of slice) {
    const status = acc.status === 'available' ? '🟢' : '🔴';
    text += `${status} *#${acc.id}* \`${acc.login}\` — ${acc.price.toLocaleString('vi-VN')}đ`;
    if (acc.note) text += ` — ${acc.note}`;
    text += '\n';
  }
  if (accounts.length > 20) text += `\n...và ${accounts.length - 20} tài khoản khác.`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🗑️ Xoá account', 'admin_delete')],
    ]),
  });
}

async function handleAdminOrders(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();

  const orders = getAllOrders();
  if (orders.length === 0) return ctx.reply('📋 Chưa có đơn hàng.');

  const STATUS_EMOJI = { paid: '✅', pending: '⏳', cancelled: '❌' };
  let text = `📋 *50 đơn hàng gần nhất*\n\n`;

  for (const o of orders.slice(0, 20)) {
    const emoji = STATUS_EMOJI[o.status] || '❓';
    text += `${emoji} *#${o.id}* @${o.username || o.telegram_id} — ${o.amount.toLocaleString('vi-VN')}đ\n`;
    text += `   ${o.created_at}\n`;
  }

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

async function handleAdminStats(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();

  const stats = getStats();
  const available = countAvailable();

  const text =
    `📊 *THỐNG KÊ CHI TIẾT*\n\n` +
    `📦 Tài khoản còn trong kho: *${available}*\n\n` +
    `📈 *Đơn hàng:*\n` +
    `• Tổng đơn: ${stats.totalOrders}\n` +
    `• Đơn thành công: ${stats.paidOrders}\n` +
    `• Đơn đang chờ: ${stats.pendingOrders}\n` +
    `• Tỷ lệ thành công: ${stats.totalOrders ? Math.round((stats.paidOrders / stats.totalOrders) * 100) : 0}%\n\n` +
    `💰 *Doanh thu:*\n` +
    `• Tổng cộng: *${stats.totalRevenue.toLocaleString('vi-VN')}đ*`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

async function handleAdminDelete(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();

  adminSessions.set(ctx.from.id, { step: 'delete_account' });
  await ctx.reply(
    `🗑️ *Xoá tài khoản*\n\nNhập ID tài khoản cần xoá (chỉ xoá được tài khoản chưa bán):\nGửi /cancel để huỷ.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleAdminTextInput(ctx, next) {
  const userId = ctx.from.id;
  if (!isAdmin(ctx)) return next();

  const session = adminSessions.get(userId);
  if (!session) return next();

  const text = ctx.message.text;
  if (text === '/cancel') {
    adminSessions.delete(userId);
    return ctx.reply('❌ Đã huỷ thao tác.');
  }

  if (session.step === 'add_account') {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const valid = [];
    const errors = [];

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 3) {
        errors.push(`❌ Sai định dạng: ${line}`);
        continue;
      }
      const [login, password, note, priceStr] = parts;
      const price = parseInt(priceStr) || 0;
      if (!login || !password) {
        errors.push(`❌ Thiếu login/password: ${line}`);
        continue;
      }
      valid.push({ login: login.trim(), password: password.trim(), note: (note || '').trim(), price });
    }

    if (valid.length > 0) {
      addAccountsBulk(valid);
      const available = countAvailable();
      notifyAllUsers(
        `🔔 *HÀNG MỚI VỀ KHO!*\n\n` +
        `📦 Vừa nhập thêm *${valid.length} tài khoản* mới.\n` +
        `🛒 Kho hiện có: *${available} tài khoản*\n\n` +
        `Nhấn để mua ngay: /start`
      ).catch(() => {});
    }

    adminSessions.delete(userId);
    let reply = `✅ Đã thêm *${valid.length}* tài khoản vào kho.`;
    if (errors.length > 0) reply += `\n\n⚠️ Lỗi:\n${errors.join('\n')}`;
    return ctx.reply(reply, { parse_mode: 'Markdown' });
  }

  if (session.step === 'adjust_balance') {
    const parts = text.split('|');
    if (parts.length !== 2) {
      adminSessions.delete(userId);
      return ctx.reply('❌ Sai định dạng. Dùng: telegram_id|số_tiền');
    }
    const targetId = parseInt(parts[0]);
    const amount = parseInt(parts[1]);
    if (isNaN(targetId) || isNaN(amount)) {
      adminSessions.delete(userId);
      return ctx.reply('❌ telegram_id hoặc số tiền không hợp lệ.');
    }
    try {
      adminAdjustBalance(targetId, amount);
    } catch (err) {
      adminSessions.delete(userId);
      return ctx.reply(`❌ ${err.message}`);
    }
    adminSessions.delete(userId);
    const sign = amount >= 0 ? '+' : '';
    return ctx.reply(`✅ Đã ${sign}${amount.toLocaleString('vi-VN')}đ cho user ${targetId}.`);
  }

  if (session.step === 'delete_account') {
    const id = parseInt(text);
    if (isNaN(id)) {
      adminSessions.delete(userId);
      return ctx.reply('❌ ID không hợp lệ.');
    }
    deleteAccount(id);
    adminSessions.delete(userId);
    return ctx.reply(`✅ Đã xoá tài khoản #${id} (nếu tồn tại và chưa bán).`);
  }

  if (session.step === 'set_discount') {
    const parts = text.split('|');
    if (parts.length !== 2) {
      adminSessions.delete(userId);
      return ctx.reply('❌ Sai định dạng. Dùng: ngưỡng|chiết_khấu_mỗi_sp');
    }
    const newMinQty = parseInt(parts[0]);
    const newDiscount = parseInt(parts[1]);
    if (isNaN(newMinQty) || isNaN(newDiscount) || newMinQty < 1 || newDiscount < 0) {
      adminSessions.delete(userId);
      return ctx.reply('❌ Giá trị không hợp lệ. Ngưỡng phải >= 1, chiết khấu phải >= 0.');
    }
    config.discount.minQty = newMinQty;
    config.discount.discountPerItem = newDiscount;
    adminSessions.delete(userId);
    const status = newDiscount > 0
      ? `✅ Đã bật chiết khấu: mua *>${newMinQty} sp*, giảm *${newDiscount.toLocaleString('vi-VN')}đ/sp*.`
      : `✅ Đã tắt chiết khấu.`;
    return ctx.reply(status, { parse_mode: 'Markdown' });
  }

  return next();
}

async function handleAdminDiscount(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();
  const { minQty, discountPerItem } = config.discount;
  adminSessions.set(ctx.from.id, { step: 'set_discount' });
  await ctx.reply(
    `🎁 *Cài chiết khấu mua số lượng nhiều*\n\n` +
    `Hiện tại:\n` +
    `• Ngưỡng: mua *>${minQty} sản phẩm*\n` +
    `• Chiết khấu: *${discountPerItem.toLocaleString('vi-VN')}đ/sản phẩm*\n\n` +
    `Nhập theo định dạng: \`ngưỡng|chiết_khấu_mỗi_sp\`\n\n` +
    `Ví dụ: \`5|5000\` (mua >5 sp, giảm 5.000đ/sp)\n` +
    `Đặt 0 để tắt chiết khấu: \`5|0\`\n\n` +
    `Gửi /cancel để huỷ.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleAdminBalance(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();
  adminSessions.set(ctx.from.id, { step: 'adjust_balance' });
  await ctx.reply(
    `💳 *Điều chỉnh số dư user*\n\n` +
    `Nhập theo định dạng:\n\`telegram_id|số_tiền\`\n\n` +
    `Ví dụ: \`123456789|50000\` (cộng 50k)\n` +
    `Ví dụ: \`123456789|-20000\` (trừ 20k)\n\n` +
    `Gửi /cancel để huỷ.`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = {
  handleAdmin,
  handleAdminAdd,
  handleAdminInventory,
  handleAdminOrders,
  handleAdminStats,
  handleAdminBalance,
  handleAdminDelete,
  handleAdminDiscount,
  handleAdminTextInput,
};





