const { pool } = require("../database/data");

async function checkEmailVerified(req, res, next) {
  try {
    const userId = req.session.userId;

    if (!userId) {
      req.flash("error", "🚫 No user session found.");
      return res.redirect("/login");
    }

    const result = await pool
      .request()
      .input("id", userId)
      .query("SELECT is_verified FROM users WHERE id = @id");

    if (result.recordset.length === 0) {
      req.flash("error", "❌ User not found in DB.");
      return res.redirect("/login");
    }

    const isVerified = result.recordset[0].is_verified;

    if (!isVerified) {
      req.flash("error", "⚠️ User email not verified. Blocking access.");
       if (req.xhr || req.headers.accept?.indexOf("json") > -1) {
       return res.status(401).json({ redirect: "/Product", error: "Email not verified" });}
       const backURL = req.get("Referer") || "/home"; 
       return res.redirect(backURL);
    }

    // All good 🚀
    next();
  } catch (err) {
    console.error("🔥 Error in email verification middleware:", err);
    req.flash("error", "🔥 Error in email verification middleware");
    const backURL = req.get("Referer") || "/home"; 
    return res.redirect(backURL);
  }
}

module.exports = checkEmailVerified;
