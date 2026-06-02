const { pool } = require("../database/data"); // ✅ import the SQL Server pool
const sql = require("mssql");

async function getUserMiddleware(req, res, next) {
  const userId = req.session.userId;

  if (!userId) {
    req.notificationCount = 0;
    return next(); // still go forward without crashing
  }

  try {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT id, firstname, lastname, email, phone, address, city, province, zip, img, is_verified, date_joined FROM users WHERE id = @userId;
        SELECT COUNT(*) AS count FROM notifications WHERE user_id = @userId;
      `);

    const loggedInUser = result.recordsets[0][0] || null;
    const notificationCount = result.recordsets[1][0]?.count || 0;

    req.loggedInUser = loggedInUser;
    req.notificationCount = notificationCount;
    next();
  } catch (err) {
    console.error("Database error in getUserMiddleware:", err);
    next(err); // pass error to Express error handler
  }
}

module.exports = getUserMiddleware;
