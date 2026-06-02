const { pool } = require("../database/data"); // ✅ import SQL Server pool

async function getCartMiddleware(req, res, next) {
  const userId = req.session.userId;

  if (!userId) {
    req.cartItems = [];
    req.cartItemsCount = 0;
    return next(); // No session, no DB query
  }

  try {
    const result = await pool
      .request()
      .input("userId", userId)
      .query("SELECT * FROM cart_items WHERE user_id = @userId");

    req.cartItems = result.recordset;
    req.cartItemsCount = result.recordset.length || 0;

    next();
  } catch (err) {
    console.error("Error fetching cart items:", err);
    return res.status(500).send("Internal Server Error");
  }
}

module.exports = getCartMiddleware;
