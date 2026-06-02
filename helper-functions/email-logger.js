const { pool } = require("../database/data");

async function logEmail(userId, userName, userEmail, purpose) {
  try {
    await pool.request()
      .input("userId", userId)
      .input("userName", userName)
      .input("userEmail", userEmail)
      .input("purpose", purpose)
      .query(`
        INSERT INTO EmailLogs (userId, userName, userEmail, purpose)
        VALUES (@userId, @userName, @userEmail, @purpose)
      `);
  } catch (err) {
    console.error("❌ Failed to log email:", err);
  }
}

module.exports = logEmail;
