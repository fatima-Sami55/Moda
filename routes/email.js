const express = require("express");
const router = express.Router();
const { pool } = require("../database/data");
const sql = require("mssql");
const isAuthenticated = require("../middleware/is-logged-in");
const { verifyCsrf } = require("../middleware/csrf");


router.delete("/email-log/:id", isAuthenticated, verifyCsrf, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;

  try {
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("userId", sql.Int, userId)
      .query("DELETE FROM EmailLogs WHERE id = @id AND userId = @userId");

    if (result.rowsAffected[0] > 0) {
      req.flash("success", "✅ Email notification deleted.");
    } else {
      req.flash("error", "❌ Notification not found or unauthorized deletion.");
    }
    res.redirect("/email"); // Go back to email logs
  } catch (err) {
    console.error("❌ Delete failed:", err);
    req.flash("error", "❌ Could not delete the Email notification.");
    res.redirect("/email");
  }
});



module.exports = router;