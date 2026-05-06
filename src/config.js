require('dotenv').config();

const config = {
  bot: {
    token: process.env.BOT_TOKEN,
    adminIds: (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean),
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  },
  sepay: {
    apiKey: process.env.SEPAY_API_KEY,
    accountNumber: process.env.SEPAY_ACCOUNT_NUMBER,
    bankCode: process.env.SEPAY_BANK_CODE,
    accountName: process.env.SEPAY_ACCOUNT_NAME,
  },
  server: {
    port: parseInt(process.env.PORT) || 3000,
    webhookUrl: process.env.WEBHOOK_URL,
  },
  order: {
    expiryMinutes: parseInt(process.env.ORDER_EXPIRY_MINUTES) || 15,
  },
  discount: {
    // Chiết khấu theo bậc: mảng các mức [{minQty, percent}], sắp xếp tăng dần theo minQty
    // Ví dụ env: DISCOUNT_TIERS=[{"minQty":5,"percent":5},{"minQty":10,"percent":10},{"minQty":20,"percent":15}]
    tiers: (() => {
      try {
        const raw = process.env.DISCOUNT_TIERS;
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        // Sắp xếp giảm dần để dễ tìm mức cao nhất áp dụng được
        return parsed
          .filter(t => typeof t.minQty === 'number' && typeof t.percent === 'number')
          .sort((a, b) => b.minQty - a.minQty);
      } catch {
        return [];
      }
    })(),
  },
};

function validate() {
  const required = [
    ['BOT_TOKEN', config.bot.token],
    ['SEPAY_API_KEY', config.sepay.apiKey],
    ['SEPAY_ACCOUNT_NUMBER', config.sepay.accountNumber],
    ['SEPAY_BANK_CODE', config.sepay.bankCode],
    ['WEBHOOK_URL', config.server.webhookUrl],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

module.exports = { config, validate };
