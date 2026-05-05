const { getAllUsers } = require('./user');

let botInstance = null;

function setBroadcastBot(bot) {
  botInstance = bot;
}

async function notifyAllUsers(message) {
  if (!botInstance) return;
  const users = getAllUsers();
  let sent = 0, failed = 0;

  for (const user of users) {
    try {
      await botInstance.telegram.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
      sent++;
    } catch {
      failed++;
    }
  }
  console.log(`[Broadcast] Sent: ${sent}, Failed: ${failed}/${users.length}`);
  return { sent, failed };
}

module.exports = { setBroadcastBot, notifyAllUsers };
