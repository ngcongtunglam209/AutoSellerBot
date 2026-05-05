const db = require('../db/index');

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

function cancelExpiredOrders() {
  const expired = db.prepare(`
    SELECT id, account_id FROM orders
    WHERE status = 'pending' AND datetime('now','localtime') > expires_at
  `).all();

  if (expired.length === 0) return 0;

  const cancel = db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`);
  const free = db.prepare(`UPDATE accounts SET status = 'available' WHERE id = ? AND status = 'reserved'`);

  db.transaction((rows) => {
    for (const r of rows) { cancel.run(r.id); if (r.account_id) free.run(r.account_id); }
  })(expired);

  return expired.length;
}

function getUserOrders(telegramId) {
  return db.prepare(`
    SELECT o.id, o.amount, o.status, o.created_at, o.paid_at, a.login, a.note
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
    pendingOrders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'pending'`).get().c,
  };
}

module.exports = {
  createOrderFromBalance,
  getOrderById,
  cancelExpiredOrders,
  getUserOrders,
  getAllOrders,
  getStats,
};
