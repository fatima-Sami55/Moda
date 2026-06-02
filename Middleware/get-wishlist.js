const { pool } = require("../database/data"); // Import SQL Server pool

async function getWishMiddleware(req, res, next) {
  const userId = req.session.userId;

  if (!userId) {
    req.wishItemsCount = 0;
    return next();
  }

  try {
    const result = await pool
      .request()
      .input("userId", userId)
      .query("SELECT * FROM wish_items WHERE user_id = @userId");

    req.wishItemsCount = result.recordset.length || 0;
    next();
  } catch (err) {
    console.error("Error fetching wishlist items:", err);
    return res.status(500).send("Internal Server Error");
  }
}

module.exports = getWishMiddleware;
