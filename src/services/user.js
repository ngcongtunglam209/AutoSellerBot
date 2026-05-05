const db = require('../db/index');

function upsertUser({ telegramId, username, fullName }) {
  db.prepare(`
    INSERT INTO users (telegram_id, username, full_name)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      full_name = excluded.full_name
  `).run(telegramId, username || null, fullName || null);
}

function getUserByTelegramId(telegramId) {
  return db.prepare(`SELECT * FROM users WHERE telegram_id = ?`).get(telegramId);
}

function getAllUsers() {
  return db.prepare(`SELECT telegram_id FROM users`).all();
}

module.exports = { upsertUser, getUserByTelegramId, getAllUsers };

