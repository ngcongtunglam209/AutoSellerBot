const axios = require('axios');
const QRCode = require('qrcode');
const { config } = require('../config');

const SEPAY_BASE = 'https://my.sepay.vn/userapi';

async function getTransactions(limit = 20) {
  const res = await axios.get(`${SEPAY_BASE}/transactions/list`, {
    headers: { Authorization: `Bearer ${config.sepay.apiKey}` },
    params: { limit_transaction: limit },
  });
  return res.data.transactions || [];
}

async function findPaymentByContent(transferContent, expectedAmount) {
  const txns = await getTransactions(50);
  return txns.find(
    (t) =>
      t.transaction_content &&
      t.transaction_content.includes(transferContent) &&
      parseInt(t.amount_in) >= expectedAmount
  ) || null;
}

async function generateQRBuffer(transferContent, amount) {
  const { accountNumber, bankCode, accountName } = config.sepay;
  const vietQRUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;
  return vietQRUrl;
}

async function generateQRDataURL(transferContent, amount) {
  const { accountNumber, bankCode, accountName } = config.sepay;
  const qrContent = `${bankCode}|${accountNumber}|${accountName}|${amount}|${transferContent}`;
  const dataUrl = await QRCode.toDataURL(qrContent, { width: 300, margin: 2 });
  return dataUrl;
}

module.exports = { getTransactions, findPaymentByContent, generateQRBuffer, generateQRDataURL };
