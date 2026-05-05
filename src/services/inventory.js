const db = require('../db/index');

function getAvailableAccounts() {
  return db.prepare(`SELECT * FROM accounts WHERE status = 'available' ORDER BY id ASC`).all();
}

function getAccountById(id) {
  return db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(id);
}

function addAccount({ login, password, note = '', price }) {
  const stmt = db.prepare(`INSERT INTO accounts (login, password, note, price) VALUES (?, ?, ?, ?)`);
  const result = stmt.run(login, password, note, price);
  return result.lastInsertRowid;
}

function addAccountsBulk(accounts) {
  const insert = db.prepare(`INSERT INTO accounts (login, password, note, price) VALUES (?, ?, ?, ?)`);
  const insertMany = db.transaction((list) => {
    for (const acc of list) {
      insert.run(acc.login, acc.password, acc.note || '', acc.price);
    }
  });
  insertMany(accounts);
}

function markAccountSold(id) {
  db.prepare(`UPDATE accounts SET status = 'sold', sold_at = datetime('now','localtime') WHERE id = ?`).run(id);
}

function deleteAccount(id) {
  db.prepare(`DELETE FROM accounts WHERE id = ? AND status = 'available'`).run(id);
}

function countAvailable() {
  return db.prepare(`SELECT COUNT(*) as count FROM accounts WHERE status = 'available'`).get().count;
}

function getAllAccounts() {
  return db.prepare(`SELECT * FROM accounts ORDER BY created_at DESC`).all();
}

module.exports = {
  getAvailableAccounts,
  getAccountById,
  addAccount,
  addAccountsBulk,
  markAccountSold,
  deleteAccount,
  countAvailable,
  getAllAccounts,
};
