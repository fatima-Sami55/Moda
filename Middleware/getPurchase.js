const { pool } = require("../database/data");

async function getPurchaseMiddleware(req, res, next) {
  const userId = req.session.userId;

  if (!userId) {
    req.purchase = [];
    req.purchaseCount = 0;
    return next();
  }

  try {
    // Fetch user-specific purchases
    const result = await pool
      .request()
      .input("userId", userId)
      .query("SELECT * FROM purchaseditems WHERE userID = @userId");

    req.purchase = result.recordset;
    req.purchaseCount = result.recordset.length || 0;

    next();
  } catch (err) {
    console.error("Error fetching purchase items:", err);
    return res.status(500).send("Internal Server Error");
  }
}

module.exports = getPurchaseMiddleware;
