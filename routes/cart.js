const express = require("express");
const router = express.Router();
const { pool } = require("../database/data");
const isAuthenticated = require("../Middleware/is_logged_in");
const checkEmailVerified = require("../Middleware/getEmailVerification");
const { verifyCsrf } = require("../Middleware/csrf");

// GET /add-to-cart
router.get("/add-to-cart", isAuthenticated,checkEmailVerified, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const result = await pool
      .request()
      .input("user_id", userId)
      .query("SELECT * FROM cart_items WHERE user_id = @user_id");

    res.render("cart.ejs", { cartItems: result.recordset, page: "cart" });
  } catch (err) {
    console.error("Error fetching cart items:", err);
    next(err);
  }
});

// POST /add-to-cart
router.post("/add-to-cart", isAuthenticated,checkEmailVerified, verifyCsrf, async (req, res, next) => {
  const { itemName, itemImage, itemDescription } = req.body;
  const userId = req.session.userId;

  if (!itemName || !itemImage || !itemDescription) {
    // Respond with JSON if AJAX, else fallback
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(400).json({ error: "All fields are required" });
    }
    req.flash("error", "All fields are required");
    return res.redirect("/add-to-cart");
  }

  // Backend price lookup to prevent client-side manipulation
  const { findProductByName } = require("../helper_functions/getRating");
  const product = findProductByName(itemName);
  if (!product) {
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(400).json({ error: "Invalid product name" });
    }
    req.flash("error", "Invalid product name");
    return res.redirect("/add-to-cart");
  }
  const itemPrice = product.price;

  try {
    // Check if item already in cart
    const checkResult = await pool
      .request()
      .input("user_id", userId)
      .input("item_name", itemName)
      .query("SELECT * FROM cart_items WHERE user_id = @user_id AND item_Name = @item_name");

    if (checkResult.recordset.length > 0) {
      if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(409).json({ error: "Item already in the cart" });
      }
      req.flash("error", "Item already in the cart");
      return res.redirect("/add-to-cart");
    }

    // Insert item into cart
    await pool
      .request()
      .input("user_id", userId)
      .input("item_name", itemName)
      .input("item_img", itemImage)
      .input("item_description", itemDescription)
      .input("item_price", itemPrice)
      .query(`
        INSERT INTO cart_items (user_id, item_Name, item_img, item_description, item_price)
        VALUES (@user_id, @item_name, @item_img, @item_description, @item_price)
      `);

    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ message: "Item added successfully!" });
    }
    req.flash("success", "Item added successfully");
    return res.redirect("/add-to-cart");
  } catch (err) {
    console.error("Error adding item to cart:", err);
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({ error: "Internal server error" });
    }
    next(err);
  }
});

// DELETE item from cart
router.post("/delete/:itemId", isAuthenticated,checkEmailVerified, verifyCsrf, async (req, res, next) => {
  const itemId = parseInt(req.params.itemId);
  const userId = req.session.userId;

  try {
    const result = await pool
      .request()
      .input("id", itemId)
      .input("userId", userId)
      .query("DELETE FROM cart_items WHERE id = @id AND user_id = @userId");

    if (result.rowsAffected[0] > 0) {
      req.flash("success", "Item deleted successfully");
    } else {
      req.flash("error", "Item not found");
    }

    return res.redirect("/add-to-cart");
  } catch (err) {
    console.error("Error deleting item from cart:", err);
    req.flash("error", "An error occurred while deleting the item!");
    return res.redirect("/add-to-cart");
  }
});

module.exports = router;
