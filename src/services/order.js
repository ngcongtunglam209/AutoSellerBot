const db = require('../db/index');
const { config } = require('../config');

function generateTransferContent() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SEVQR${ts}${rand}`;
}

function createOrder({ telegramId, accountId, amount }) {
  const user = db.prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(telegramId);
  if (!user) throw new Error('User not found');

  const transferContent = generateTransferContent();
  const expiryMinutes = config.order.expiryMinutes;

  const stmt = db.prepare(`
    INSERT INTO orders (user_id, account_id, amount, transfer_content, status, expires_at)
    VALUES (
      ?, ?, ?, ?, 'pending',
      datetime('now', 'localtime', '+${expiryMinutes} minutes')
    )
  `);
  const result = stmt.run(user.id, accountId, amount, transferContent);
  return { orderId: result.lastInsertRowid, transferContent };
}

function getOrderByTransferContent(transferContent) {
  return db.prepare(`
    SELECT o.*, u.telegram_id, a.login, a.password, a.note
    FROM orders o
    JOIN users u ON o.user_id = u.id
    LEFT JOIN accounts a ON o.account_id = a.id
    WHERE o.transfer_content = ?
  `).get(transferContent);
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

function markOrderPaid(orderId) {
  db.prepare(`
    UPDATE orders SET status = 'paid', paid_at = datetime('now','localtime')
    WHERE id = ? AND status = 'pending'
  `).run(orderId);
}

function cancelExpiredOrders() {
  const expired = db.prepare(`
    SELECT o.id, o.account_id FROM orders o
    WHERE o.status = 'pending' AND datetime('now','localtime') > o.expires_at
  `).all();

  const cancelOrder = db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`);
  const freeAccount = db.prepare(`UPDATE accounts SET status = 'available' WHERE id = ? AND status = 'reserved'`);

  const cancel = db.transaction((rows) => {
    for (const row of rows) {
      cancelOrder.run(row.id);
      if (row.account_id) freeAccount.run(row.account_id);
    }
  });
  cancel(expired);
  return expired.length;
}

function getUserOrders(telegramId) {
  return db.prepare(`
    SELECT o.id, o.amount, o.status, o.transfer_content,
           o.created_at, o.paid_at, a.login, a.note
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
  createOrder,
  getOrderByTransferContent,
  getOrderById,
  markOrderPaid,
  cancelExpiredOrders,
  getUserOrders,
  getAllOrders,
  getStats,
};

