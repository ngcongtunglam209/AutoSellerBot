const db = require('../db/index');
const { config } = require('../config');

function createBulkOrderFromBalance({ telegramId, quantity }) {
  const tx = db.transaction(() => {
    const user = db.prepare(`SELECT id, balance FROM users WHERE telegram_id = ?`).get(telegramId);
    if (!user) throw new Error('User not found');

    const accounts = db.prepare(
      `SELECT * FROM accounts WHERE status = 'available' ORDER BY id ASC LIMIT ?`
    ).all(quantity);

    if (accounts.length === 0) throw new Error('OUT_OF_STOCK');
    if (accounts.length < quantity) throw new Error(`NOT_ENOUGH:${accounts.length}`);

    const totalOriginal = accounts.reduce((sum, a) => sum + a.price, 0);

    // Tính chiết khấu theo bậc: tìm mức cao nhất đú điều kiện (quantity > minQty)
    const { tiers } = config.discount;
    const matchedTier = (tiers || []).find(t => quantity > t.minQty) || null;
    const discountPercent = matchedTier ? matchedTier.percent : 0;
    const discountTotal = Math.round(totalOriginal * discountPercent / 100);
    const totalPrice = totalOriginal - discountTotal;

    if (user.balance < totalPrice) throw new Error('INSUFFICIENT_BALANCE');

    db.prepare(`UPDATE users SET balance = balance - ? WHERE id = ?`).run(totalPrice, user.id);

    const orders = [];
    for (const account of accounts) {
      db.prepare(`UPDATE accounts SET status = 'sold', sold_at = datetime('now','localtime') WHERE id = ?`).run(account.id);
      const ref = 'BAL' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const result = db.prepare(`
        INSERT INTO orders (user_id, account_id, amount, transfer_content, status, paid_at)
        VALUES (?, ?, ?, ?, 'paid', datetime('now','localtime'))
      `).run(user.id, account.id, account.price, ref);
      orders.push({ orderId: result.lastInsertRowid, account });
    }

    return { orders, totalPrice, totalOriginal, discountTotal, discountPercent };
  });

  return tx();
}

function createOrderFromBalance({ telegramId, accountId }) {
  const tx = db.transaction(() => {
    const user = db.prepare(`SELECT id, balance FROM users WHERE telegram_id = ?`).get(telegramId);
    if (!user) throw new Error('User not found');

    const account = db.prepare(`SELECT * FROM accounts WHERE id = ? AND status = 'available'`).get(accountId);
    if (!account) throw new Error('ACCOUNT_TAKEN');

    if (user.balance < account.price) throw new Error('INSUFFICIENT_BALANCE');

    db.prepare(`UPDATE users SET balance = balance - ? WHERE id = ?`).run(account.price, user.id);
    db.prepare(`UPDATE accounts SET status = 'sold', sold_at = datetime('now','localtime') WHERE id = ?`).run(accountId);

    const ref = 'BAL' + Date.now().toString(36).toUpperCase();
    const result = db.prepare(`
      INSERT INTO orders (user_id, account_id, amount, transfer_content, status, paid_at)
      VALUES (?, ?, ?, ?, 'paid', datetime('now','localtime'))
    `).run(user.id, accountId, account.price, ref);

    return { orderId: result.lastInsertRowid, account };
  });

  return tx();
}

function getOrderById(id) {
  return db.prepare(`
    SELECT o.*, u.telegram_id, a.login, a.password, a.note
    FROM orders o
    JOIN users u ON o.user_id = u.id
    LEFT JOIN accounts a ON o.account_id = a.id
    WHERE o.id = ?
  `).get(id);
}

function cancelExpiredDeposits() {
  const result = db.prepare(`
    UPDATE deposits SET status = 'expired'
    WHERE status = 'pending' AND datetime('now','localtime') > expires_at
  `).run();
  return result.changes;
}

function getUserOrders(telegramId) {
  return db.prepare(`
    SELECT o.id, o.amount, o.status, o.created_at, o.paid_at, a.login, a.password, a.note
    FROM orders o
    JOIN users u ON o.user_id = u.id
    LEFT JOIN accounts a ON o.account_id = a.id
    WHERE u.telegram_id = ?
    ORDER BY o.created_at DESC
    LIMIT 20
  `).all(telegramId);
}

function getAllOrders() {
  return db.prepare(`
    SELECT o.*, u.telegram_id, u.username, a.login
    FROM orders o
    JOIN users u ON o.user_id = u.id
    LEFT JOIN accounts a ON o.account_id = a.id
    ORDER BY o.created_at DESC
    LIMIT 50
  `).all();
}

function getStats() {
  return {
    totalOrders: db.prepare(`SELECT COUNT(*) as c FROM orders`).get().c,
    paidOrders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'paid'`).get().c,
    totalRevenue: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM orders WHERE status = 'paid'`).get().s,
    pendingOrders: 0,
    // Thống kê hôm nay
    todayOrders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'paid' AND date(paid_at) = date('now','localtime')`).get().c,
    todayRevenue: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM orders WHERE status = 'paid' AND date(paid_at) = date('now','localtime')`).get().s,
    // Thống kê tháng này
    monthOrders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now','localtime')`).get().c,
    monthRevenue: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM orders WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now','localtime')`).get().s,
  };
}

module.exports = {
  createBulkOrderFromBalance,
  createOrderFromBalance,
  getOrderById,
  cancelExpiredDeposits,
  getUserOrders,
  getAllOrders,
  getStats,
};
