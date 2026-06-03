const express = require("express");
const router = express.Router();
const { pool } = require("../database/data");
const sql = require("mssql");

// Middlewares
const getUserMiddleware = require("../middleware/get-user");
const getCartMiddleware = require("../middleware/get-cart");
const isAuthenticated = require("../middleware/is-logged-in");
const checkEmailVerified = require("../middleware/get-email-verification");
const { verifyCsrf } = require("../middleware/csrf");

// Email/Logger Helpers
const { sendOrderConfirmationEmail } = require("../helper-functions/email");
const logEmail = require("../helper-functions/email-logger");

/* ==========================================================================
   GET ROUTES
   ========================================================================== */

router.get("/checkout", isAuthenticated, getUserMiddleware, getCartMiddleware, checkEmailVerified, (req, res) => {
  res.status(200).render("checkout", {
    loggedInUser: req.loggedInUser,
    cartItemsCount: req.cartItemsCount,
  });
});

router.get("/safe-checkout", isAuthenticated, checkEmailVerified, async (req, res, next) => {
  res.redirect("/checkout");
});

/* ==========================================================================
   POST ROUTES
   ========================================================================== */

router.post("/checkout", isAuthenticated, checkEmailVerified, verifyCsrf, async (req, res, next) => {
  const userId = req.session.userId;
  const { ShippingAddress, PurchaseDate } = req.body;

  try {
    const cartResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM cart_items WHERE user_id = @userId");

    const cartItems = cartResult.recordset;
    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty." });
    }

    const { findProductByName } = require("../helper-functions/get-rating");
    let computedSubtotal = 0;
    let computedQuantity = 0;

    for (const item of cartItems) {
      const product = findProductByName(item.item_Name);
      const price = product ? product.price : parseFloat(item.item_price);
      computedSubtotal += price;
      computedQuantity += 1;
    }

    const shippingFee = computedSubtotal > 150 ? 0.00 : 15.00;
    const finalTotalPrice = computedSubtotal + shippingFee;
    const orderStatus = "Placed";

    const now = new Date();
    const arrivalDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const shipmentDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const deliveryDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

    const result = await pool.request()
      .input("TotalPrice", sql.Decimal(10, 2), finalTotalPrice)
      .input("OrderStatus", sql.VarChar, orderStatus)
      .input("ShippingAddress", sql.VarChar, ShippingAddress)
      .input("Quantity", sql.Int, computedQuantity)
      .input("PurchaseDate", sql.DateTime, new Date(PurchaseDate || now))
      .input("UserId", sql.Int, userId)
      .input("arrivalDate", sql.DateTime, arrivalDate)
      .input("shipmentDate", sql.DateTime, shipmentDate)
      .input("deliveryDate", sql.DateTime, deliveryDate)
      .query(`
        INSERT INTO purchaseditems (TotalPrice, OrderStatus, ShippingAddress, Quantity, PurchaseDate, UserId, arrivalDate, shipmentDate, deliveryDate)
        OUTPUT INSERTED.PurchaseID
        VALUES (@TotalPrice, @OrderStatus, @ShippingAddress, @Quantity, @PurchaseDate, @UserId, @arrivalDate, @shipmentDate, @deliveryDate)
      `);

    if (result.recordset.length > 0) {
      const orderId = result.recordset[0].PurchaseID;
      req.session.OrderId = orderId;
      req.flash("success", "Checkout step 1 completed successfully!");
      return res.status(200).json({ success: true, message: "Checkout completed successfully!" });
    } else {
      req.flash("error", "Checkout failed. Please try again!");
      return res.status(500).json({ success: false, message: "Checkout failed. Please try again." });
    }
  } catch (err) {
    console.error("[Checkout] checkout post error:", err);
    next(err);
  }
});

router.post("/safe-checkout", isAuthenticated, getCartMiddleware, checkEmailVerified, verifyCsrf, async (req, res, next) => {
  const userId = req.session.userId;
  const fullName = req.session.user.firstname + " " + req.session.user.lastname;
  const email = req.session.user.email;
  const { cardType, quantities, ShippingAddress, PurchaseDate } = req.body;

  if (!cardType) {
    req.flash("error", "No card type selected");
    return res.redirect("/safe-checkout");
  }

  if (!req.cartItems || req.cartItems.length === 0) {
    return res.status(400).json({ success: false, message: "Your cart is empty." });
  }

  const parsedQuantities = JSON.parse(quantities || "[]");

  try {
    const { findProductByName } = require("../helper-functions/get-rating");
    let computedSubtotal = 0;
    let computedQuantity = 0;

    for (let i = 0; i < req.cartItems.length; i++) {
      const item = req.cartItems[i];
      const qty = parseInt(parsedQuantities[i], 10) || 1;
      const product = findProductByName(item.item_Name);
      const price = product ? product.price : parseFloat(item.item_price);
      computedSubtotal += price * qty;
      computedQuantity += qty;
    }

    const shippingFee = computedSubtotal > 150 ? 0.00 : 15.00;
    const finalTotalPrice = computedSubtotal + shippingFee;
    const orderStatus = "Placed";

    const now = new Date();
    const arrivalDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const shipmentDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const deliveryDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

    const result = await pool.request()
      .input("TotalPrice", sql.Decimal(10, 2), finalTotalPrice)
      .input("OrderStatus", sql.VarChar, orderStatus)
      .input("ShippingAddress", sql.VarChar, ShippingAddress)
      .input("Quantity", sql.Int, computedQuantity)
      .input("PurchaseDate", sql.DateTime, new Date(PurchaseDate || now))
      .input("UserId", sql.Int, userId)
      .input("PaymentMethod", sql.VarChar, cardType)
      .input("shipping_fee", sql.Decimal(10, 2), shippingFee)
      .input("Discount", sql.Decimal(10, 2), 0.00)
      .input("arrivalDate", sql.DateTime, arrivalDate)
      .input("shipmentDate", sql.DateTime, shipmentDate)
      .input("deliveryDate", sql.DateTime, deliveryDate)
      .query(`
        INSERT INTO purchaseditems (TotalPrice, OrderStatus, ShippingAddress, Quantity, PurchaseDate, UserId, PaymentMethod, shipping_fee, Discount, arrivalDate, shipmentDate, deliveryDate)
        OUTPUT INSERTED.PurchaseID
        VALUES (@TotalPrice, @OrderStatus, @ShippingAddress, @Quantity, @PurchaseDate, @UserId, @PaymentMethod, @shipping_fee, @Discount, @arrivalDate, @shipmentDate, @deliveryDate)
      `);

    const purchaseId = result.recordset[0].PurchaseID;

    for (let i = 0; i < req.cartItems.length; i++) {
      const item = req.cartItems[i];
      const parsedQty = parseInt(parsedQuantities[i], 10) || 1;
      const product = findProductByName(item.item_Name);
      const price = product ? product.price : parseFloat(item.item_price);

      await pool.request()
        .input("itemName", sql.VarChar, item.item_Name)
        .input("itemImg", sql.VarChar, item.item_img)
        .input("itemDesc", sql.VarChar, item.item_description)
        .input("itemPrice", sql.Decimal(10, 2), price)
        .input("userId", sql.Int, userId)
        .input("quantity", sql.Int, parsedQty)
        .input("purchaseId", sql.Int, purchaseId)
        .query(`
          INSERT INTO orders (itemName, item_img, itemDescription, item_price, user_id, quantity, purchase_id)
          VALUES (@itemName, @itemImg, @itemDesc, @itemPrice, @userId, @quantity, @purchaseId)
        `);
    }

    await pool.request()
      .input("user_id", sql.Int, userId)
      .query("DELETE FROM cart_items WHERE user_id = @user_id");

    await sendOrderConfirmationEmail({ to: email, orderId: purchaseId, type: "placed" })
      .catch(err => console.error("[Checkout] Order confirmation email failed to send:", err));
      
    await logEmail(userId, fullName, email, "order_placed");

    req.flash("success", "Order is placed. Thanks!");
    return res.status(200).json({ success: true, message: "Payment information updated successfully!" });

  } catch (err) {
    console.error("[Checkout] Safe checkout error:", err);
    next(err);
  }
});

module.exports = router;