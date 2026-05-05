const db = require('./index');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE NOT NULL,
      username TEXT,
      full_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL,
      password TEXT NOT NULL,
      note TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      sold_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER,
      amount INTEGER NOT NULL,
      transfer_content TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      expires_at TEXT NOT NULL,
      paid_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_transfer ON orders(transfer_content);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
  `);
  console.log('[DB] Schema initialized');
}

module.exports = { initSchema };
