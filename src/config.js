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
    // Mua >= minQty thì được chiết khấu discountPerItem mỗi sản phẩm
    minQty: parseInt(process.env.DISCOUNT_MIN_QTY) || 5,
    discountPerItem: parseInt(process.env.DISCOUNT_PER_ITEM) || 0,
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
