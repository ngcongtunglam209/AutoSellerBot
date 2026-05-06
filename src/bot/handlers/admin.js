const { Markup } = require('telegraf');
const { config } = require('../../config');
const {
  addAccountsBulk, deleteAccount,
  getAllAccounts, countAvailable,
} = require('../../services/inventory');
const { getAllOrders, getStats } = require('../../services/order');
const { adminAdjustBalance } = require('../../services/wallet');
const { notifyAllUsers } = require('../../services/broadcast');
const { safeMd } = require('../../utils/escape');

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

  const { tiers } = config.discount;
  let discountInfo;
  if (!tiers || tiers.length === 0) {
    discountInfo = `🎁 Chiết khấu: *Chưa bật*`;
  } else {
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    discountInfo = `🎁 Chiết khấu:\n` +
      sorted.map(t => `  • Mua >${t.minQty} sp: giảm *${t.percent}%*`).join('\n');
  }

  await ctx.reply(text + '\n' + discountInfo, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('➕ Thêm account', 'admin_add')],
      [Markup.button.callback('📦 Xem kho hàng', 'admin_inventory'), Markup.button.callback('📋 Đơn hàng', 'admin_orders')],
      [Markup.button.callback('💸 Hàng đã bán', 'admin_sold'), Markup.button.callback('📊 Thống kê', 'admin_stats')],
      [Markup.button.callback('💳 Điều chỉnh số dư', 'admin_balance')],
      [Markup.button.callback('🎁 Cài chiết khấu', 'admin_discount'), Markup.button.callback('👥 Quản lý user', 'admin_users')],
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
    text += `${status} *#${acc.id}* \`${safeMd(acc.login)}\` — ${acc.price.toLocaleString('vi-VN')}đ`;
    if (acc.note) text += ` — ${safeMd(acc.note)}`;
    text += '\n';
  }
  if (accounts.length > 20) text += `\n...và ${accounts.length - 20} tài khoản khác.`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🗑️ Xoá account', 'admin_delete')],
      [Markup.button.callback('🔙 Quay lại', 'admin_back')],
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
    text += `${emoji} *#${o.id}* ${safeMd(o.username ? '@' + o.username : '#' + o.telegram_id)} — ${o.amount.toLocaleString('vi-VN')}đ\n`;
    text += `   ${o.created_at}\n`;
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Quay lại', 'admin_back')]]),
  });
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
    `• Tổng cộng: *${stats.totalRevenue.toLocaleString('vi-VN')}đ*\n` +
    `• Hôm nay: *${stats.todayRevenue.toLocaleString('vi-VN')}đ* (${stats.todayOrders} đơn)\n` +
    `• Tháng này: *${stats.monthRevenue.toLocaleString('vi-VN')}đ* (${stats.monthOrders} đơn)`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Quay lại', 'admin_back')]]),
  });
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
    // Định dạng mới: "5,10%|10,15%|20,20%" (minQty,percent mỗi bậc cách nhau |)
    // Hoặc "0" để tắt chiết khấu
    if (text.trim() === '0') {
      config.discount.tiers = [];
      adminSessions.delete(userId);
      return ctx.reply('✅ Đã tắt toàn bộ chiết khấu.', { parse_mode: 'Markdown' });
    }
    const entries = text.split('|').map(s => s.trim()).filter(Boolean);
    const newTiers = [];
    for (const entry of entries) {
      const m = entry.match(/^(\d+),(\d+)%?$/);
      if (!m) {
        adminSessions.delete(userId);
        return ctx.reply(`❌ Sai định dạng: \`${entry}\`\nDùng: \`ngưỡng,phần_trăm\` (VD: \`5,10|10,15\`)\nHoặc gửi \`0\` để tắt chiết khấu.`, { parse_mode: 'Markdown' });
      }
      const minQty = parseInt(m[1]);
      const percent = parseInt(m[2]);
      if (minQty < 1 || percent < 0 || percent > 100) {
        adminSessions.delete(userId);
        return ctx.reply('❌ Ngưỡng phải >= 1, phần trăm từ 0-100.');
      }
      newTiers.push({ minQty, percent });
    }
    // Sắp xếp giảm dần (để dễ tìm mức cao nhất áp dụng được)
    newTiers.sort((a, b) => b.minQty - a.minQty);
    config.discount.tiers = newTiers;
    adminSessions.delete(userId);
    const sorted = [...newTiers].sort((a, b) => a.minQty - b.minQty);
    const tierLines = sorted.map(t => `  • Mua >${t.minQty} sp: giảm *${t.percent}%*`).join('\n');
    return ctx.reply(`✅ Đã cập nhật chiết khấu:\n${tierLines}`, { parse_mode: 'Markdown' });
  }

  return next();
}

async function handleAdminDiscount(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();
  const { tiers } = config.discount;
  adminSessions.set(ctx.from.id, { step: 'set_discount' });

  let currentInfo;
  if (!tiers || tiers.length === 0) {
    currentInfo = `Chưa có chiết khấu nào được cài.`;
  } else {
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    currentInfo = sorted.map(t => `  • Mua >${t.minQty} sp: giảm *${t.percent}%*`).join('\n');
  }

  await ctx.reply(
    `🎁 *Cài chiết khấu mua số lượng nhiều*\n\n` +
    `Hiện tại:\n${currentInfo}\n\n` +
    `Nhập các bậc chiết khấu theo định dạng:\n` +
    `\`ngưỡng,phần_trăm|ngưỡng,phần_trăm\`\n\n` +
    `Ví dụ: \`5,10|10,15|20,20\`\n` +
    `(Mua >5 sp giảm 10%, >10 sp giảm 15%, >20 sp giảm 20%)\n\n` +
    `Gửi \`0\` để tắt toàn bộ chiết khấu.\n` +
    `Gửi /cancel để huỷ.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleAdminUsers(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();

  const db = require('../../db/index');
  const users = db.prepare(`
    SELECT telegram_id, username, full_name, balance, created_at
    FROM users ORDER BY balance DESC LIMIT 20
  `).all();

  if (users.length === 0) return ctx.reply('👥 Chưa có user nào.');

  let text = `👥 *Danh sách user (top 20 theo số dư)*\n\n`;
  for (const u of users) {
    const name = safeMd(u.username ? `@${u.username}` : (u.full_name || `#${u.telegram_id}`));
    text += `• ${name} — 💰 *${u.balance.toLocaleString('vi-VN')}đ*\n`;
    text += `  ID: \`${u.telegram_id}\`\n`;
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Quay lại', 'admin_back')]]),
  });
}

async function handleAdminSoldItems(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();

  const db = require('../../db/index');
  const sold = db.prepare(`
    SELECT a.login, a.password, a.note, a.price,
           o.id as order_id, o.created_at,
           u.username, u.telegram_id
    FROM accounts a
    JOIN orders o ON o.account_id = a.id
    JOIN users u ON o.user_id = u.id
    WHERE a.status = 'sold' AND o.status = 'paid'
    ORDER BY o.created_at DESC
    LIMIT 20
  `).all();

  if (sold.length === 0) return ctx.reply('💸 Chưa có hàng nào được bán.');

  let text = `💸 *Hàng đã bán (${sold.length} gần nhất)*\n\n`;
  for (const item of sold) {
    const buyer = safeMd(item.username ? `@${item.username}` : `#${item.telegram_id}`);
    text += `*— Đơn #${item.order_id} —*\n`;
    text += `👤 Khách: ${buyer}\n`;
    text += `🔑 Login: \`${safeMd(item.login)}\`\n`;
    text += `🔒 Pass: \`${safeMd(item.password)}\`\n`;
    if (item.note) text += `📝 ${safeMd(item.note)}\n`;
    text += `💰 Giá: *${item.price.toLocaleString('vi-VN')}đ* | 📅 ${item.created_at}\n\n`;
  }

  // Telegram giới hạn 4096 ký tự — cắt nếu quá dài
  if (text.length > 3800) {
    text = text.slice(0, 3800) + '\n\n_... (xem thêm trong DB)_';
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Quay lại', 'admin_back')]]),
  });
}

async function handleAdminBack(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Không có quyền');
  await ctx.answerCbQuery();
  return handleAdmin(ctx);
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
  handleAdminUsers,
  handleAdminBack,
  handleAdminSoldItems,
};





