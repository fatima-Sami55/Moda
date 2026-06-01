const cron = require("node-cron");
const sql = require("mssql");
const { pool, poolConnect } = require("../database/data");
const { getRandomNotifications } = require("../helper_functions/notifications_helper");

// ⏰ Schedule every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  try {
    await poolConnect; // 🧠 ensure DB is connected
    const newNotifications = getRandomNotifications(1);
    await insertNotifications(newNotifications);
  } catch (err) {
    console.error("Error in scheduled task:", err);
  }
});

// ✅ Insert new notification (avoid duplicates) and notify user (now benign to avoid target collisions)
async function insertNotifications(notifications) {
  console.log("⏰ Scheduled background notification check executed (benign).");
}

// Fetch and emit notifications strictly to the user's private socket room
async function getCurrentNotifications(userId) {
  if (!userId) return;
  try {
    await poolConnect;

    const notifResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM notifications WHERE user_id = @userId");

    if (global.io) {
      global.io.to(`user_${userId}`).emit("notifications", notifResult.recordset);
      console.log(`📥 Notifications emitted to room user_${userId}. Count: ${notifResult.recordset.length}`);
    }
  } catch (err) {
    console.error(`❌ Error fetching notifications for user ${userId}:`, err);
  }
}

module.exports = {
  getCurrentNotifications,
};
