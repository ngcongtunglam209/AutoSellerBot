const { Telegraf } = require('telegraf');
const { config } = require('../config');
const { setBroadcastBot } = require('../services/broadcast');
const { handleStart, handleHelp } = require('./handlers/start');
const { handleShop, handleShopPage, handleBuyQuantity, handleBuyQtyTextInput } = require('./handlers/shop');
const { handleConfirmBuy, handleDoBuy, handleCancelBuy, handleConfirmBulkBuy, handleDoBuyBulk, setOrderBot } = require('./handlers/order');
const { handleHistory } = require('./handlers/history');
const { handleWallet, handleDepositStart, handleDepositHistory, handleDepositTextInput } = require('./handlers/wallet');
const {
  handleAdmin, handleAdminAdd, handleAdminInventory,
  handleAdminOrders, handleAdminStats, handleAdminBalance,
  handleAdminDelete, handleAdminDiscount, handleAdminTextInput,
  handleAdminUsers, handleAdminBack, handleAdminSoldItems,
} = require('./handlers/admin');

function createBot() {
  const bot = new Telegraf(config.bot.token);

  bot.command('start', handleStart);
  bot.command('admin', handleAdmin);
  bot.command('help', handleHelp);

  bot.hears('🛒 Mua Tài Khoản', handleShop);
  bot.hears('💳 Ví Của Tôi', handleWallet);
  bot.hears('📋 Lịch Sử Mua Hàng', handleHistory);
  bot.hears('ℹ️ Hỗ Trợ', handleHelp);

  bot.action(/^shop_page:(\d+)$/, handleShopPage);
  bot.action(/^buy:(\d+)$/, handleConfirmBuy);
  bot.action(/^do_buy:(\d+)$/, handleDoBuy);
  bot.action('cancel_buy', handleCancelBuy);
  bot.action('buy_qty', handleBuyQuantity);
  bot.action(/^qty:(\d+)$/, handleConfirmBulkBuy);
  bot.action(/^do_bulk:(\d+)$/, handleDoBuyBulk);

  bot.action('deposit_start', handleDepositStart);
  bot.action('deposit_history', handleDepositHistory);

  bot.action('admin_add', handleAdminAdd);
  bot.action('admin_inventory', handleAdminInventory);
  bot.action('admin_orders', handleAdminOrders);
  bot.action('admin_stats', handleAdminStats);
  bot.action('admin_balance', handleAdminBalance);
  bot.action('admin_delete', handleAdminDelete);
  bot.action('admin_discount', handleAdminDiscount);
  bot.action('admin_users', handleAdminUsers);
  bot.action('admin_back', handleAdminBack);
  bot.action('admin_sold', handleAdminSoldItems);

  bot.on('text', async (ctx, next) => {
    await handleBuyQtyTextInput(ctx, async () => {
      await handleDepositTextInput(ctx, async () => {
        await handleAdminTextInput(ctx, next);
      });
    });
  });

  setBroadcastBot(bot);
  setOrderBot(bot);

  bot.catch((err, ctx) => {
    console.error(`[Bot] Error for ${ctx.updateType}:`, err.message);
    ctx.reply('❌ Có lỗi xảy ra. Vui lòng thử lại sau.').catch(() => {});
  });

  return bot;
}

module.exports = { createBot };

