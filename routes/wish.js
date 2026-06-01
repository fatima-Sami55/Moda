const express = require("express");
const router = express.Router();
const { pool } = require("../database/data");
const sql = require("mssql");
const isAuthenticated = require("../Middleware/is_logged_in");
const checkEmailVerified = require("../Middleware/getEmailVerification");
const { verifyCsrf } = require("../Middleware/csrf");



router.get("/wish", isAuthenticated,checkEmailVerified, async (req, res) => {
  const userId = req.session.userId;
  try {
    const result = await pool.request().input("user_id", userId).query("SELECT * FROM wish_items WHERE user_id = @user_id");
    const { getAllProductRatings } = require("../helper_functions/getRating");
    const ratingsMap = await getAllProductRatings();
    res.render("wish.ejs", { data: result.recordset, page: "wish", ratingsMap });
  } catch (err) {
    console.error("Error fetching wishlist items:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/wish", isAuthenticated,checkEmailVerified, verifyCsrf, async (req, res) => {
  const { itemName, itemImage, itemDescription } = req.body;
  const userId = req.session.userId;
  const currentDate = new Date();

  // Secure backend price lookup to prevent client-side manipulation
  const { findProductByName } = require("../helper_functions/getRating");
  const product = findProductByName(itemName);
  if (!product) {
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(400).json({ error: "Invalid product name" });
    }
    req.flash("error", "Invalid product name");
    return res.redirect("/wish");
  }
  const itemPrice = product.price;

  try {
    const check = await pool
      .request()
      .input("user_id", userId)
      .input("item_name", itemName)
      .query("SELECT * FROM wish_items WHERE user_id = @user_id AND item_Name = @item_name");

    if (check.recordset.length > 0) {
      if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(409).json({ error: "Item already in the wishlist" });
      }
      req.flash("error", "Item already in the wishlist");
      return res.redirect("/wish");
    }

    await pool
      .request()
      .input("user_id", userId)
      .input("item_name", itemName)
      .input("item_image", itemImage)
      .input("item_description", itemDescription)
      .input("item_price", itemPrice)
      .input("item_date",sql.DateTime, currentDate)
      .query("INSERT INTO wish_items (user_id, item_Name, item_image, item_description, item_price, item_date) VALUES (@user_id, @item_name, @item_image, @item_description, @item_price, @item_date)");

    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ message: "Item added to wishlist successfully" });
    }
    req.flash("success", "Item added to wishlist successfully");
    return res.redirect("/wish");
  } catch (err) {
    console.error("Error adding item to wishlist:", err);
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({ error: "Internal server error" });
    }
    res.status(500).send("Internal Server Error");
  }
});

router.post("/delete/wishItem/:id", isAuthenticated,checkEmailVerified, verifyCsrf, async (req, res) => {
  const itemId = parseInt(req.params.id);
  const userId = req.session.userId;
  try {
    const result = await pool
      .request()
      .input("id", itemId)
      .input("user_id", userId)
      .query("DELETE FROM wish_items WHERE id = @id AND user_id = @user_id");

    if (result.rowsAffected[0] > 0) {
      req.flash("success", "Item deleted successfully");
    } else {
      req.flash("error", "Item not found or permission denied");
    }
    return res.redirect("/wish");
  } catch (err) {
    console.error("Error deleting wishlist item:", err);
    req.flash("error", "Server error");
    return res.redirect("/wish");
  }
});


module.exports = router;