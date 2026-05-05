const db = require('../db/index');

function generateDepositContent() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SEVQR${ts}${rand}`;
}

function getBalance(telegramId) {
  const user = db.prepare(`SELECT balance FROM users WHERE telegram_id = ?`).get(telegramId);
  return user ? user.balance : 0;
}

function createDeposit(telegramId, amount) {
  const user = db.prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(telegramId);
  if (!user) throw new Error('User not found');

  const transferContent = generateDepositContent();
  db.prepare(`
    INSERT INTO deposits (user_id, amount, transfer_content, expires_at)
    VALUES (?, ?, ?, datetime('now', 'localtime', '+30 minutes'))
  `).run(user.id, amount, transferContent);

  return transferContent;
}

function getDepositByContent(transferContent) {
  return db.prepare(`
    SELECT d.*, u.telegram_id
    FROM deposits d
    JOIN users u ON d.user_id = u.id
    WHERE d.transfer_content = ?
  `).get(transferContent);
}

function confirmDeposit(depositId, actualAmount) {
  const deposit = db.prepare(`
    SELECT d.*, u.telegram_id
    FROM deposits d JOIN users u ON d.user_id = u.id
    WHERE d.id = ? AND d.status = 'pending'
  `).get(depositId);

  if (!deposit) throw new Error('Deposit not found or already processed');

  const finalAmount = actualAmount || deposit.amount;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE deposits SET status = 'confirmed', confirmed_at = datetime('now','localtime')
      WHERE id = ?
    `).run(depositId);
    db.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`).run(finalAmount, deposit.user_id);
  });
  tx();

  return { ...deposit, finalAmount };
}

function getDepositHistory(telegramId) {
  return db.prepare(`
    SELECT d.amount, d.status, d.created_at, d.confirmed_at
    FROM deposits d
    JOIN users u ON d.user_id = u.id
    WHERE u.telegram_id = ?
    ORDER BY d.created_at DESC
    LIMIT 10
  `).all(telegramId);
}

function adminAdjustBalance(telegramId, amount) {
  db.prepare(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`).run(amount, telegramId);
}

module.exports = {
  getBalance,
  createDeposit,
  getDepositByContent,
  confirmDeposit,
  getDepositHistory,
  adminAdjustBalance,
};

