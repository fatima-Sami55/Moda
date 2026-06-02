const { pool } = require("../database/data"); // ✅ import the mssql pool

async function getOrderMiddleware(req, res, next) {
  const userId = req.session.userId;

  if (!userId) {
    req.orders = [];
    return next();
  }

  try {
    const result = await pool
      .request()
      .input("userId", userId)
      .query("SELECT * FROM orders WHERE user_id = @userId");

    req.orders = result.recordset;
    next();
  } catch (err) {
    console.error("Error fetching orders:", err);
    return res.status(500).send("Internal Server Error");
  }
}

module.exports = getOrderMiddleware;
