const express = require("express");
const router = express.Router();
const { pool } = require("../database/data");
const sql = require("mssql");
const getUserMiddleware = require("../Middleware/getUser");
const getCartMiddleware = require("../Middleware/getCart");
const isAuthenticated = require("../Middleware/is_logged_in");
const checkEmailVerified = require("../Middleware/getEmailVerification");
const { html1 } = require("../helper_functions/emailMessages");
const logEmail = require("../helper_functions/emailLogger");
const sendEmail = require("../helper_functions/emailWriter");
const { verifyCsrf } = require("../Middleware/csrf");


router.get("/checkout", isAuthenticated, getUserMiddleware, getCartMiddleware,checkEmailVerified, (req, res) => {
  res.render("checkout", {
    loggedInUser: req.loggedInUser,
    cartItemsCount: req.cartItemsCount,
  });
});

router.post("/checkout", isAuthenticated, checkEmailVerified, verifyCsrf, async (req, res) => {
  const userId = req.session.userId;
  const {
    ShippingAddress,
    PurchaseDate,
  } = req.body;

  try {
    // 1. Fetch user's cart items from DB to compute actual TotalPrice and Quantity
    const cartResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM cart_items WHERE user_id = @userId");

    const cartItems = cartResult.recordset;
    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty." });
    }

    const { findProductByName } = require("../helper_functions/getRating");
    let computedSubtotal = 0;
    let computedQuantity = 0;

    for (const item of cartItems) {
      const product = findProductByName(item.item_Name);
      const price = product ? product.price : parseFloat(item.item_price);
      computedSubtotal += price; // default quantity is 1
      computedQuantity += 1;
    }

    const shippingFee = computedSubtotal > 150 ? 0.00 : 15.00;
    const finalTotalPrice = computedSubtotal + shippingFee;

    // Secure initial state
    const orderStatus = "Placed";

    // Generate progressive tracking dates
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
    const shipmentDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days
    const deliveryDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000); // 8 days

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
    console.error("SQL Error:", err);
    return res.status(500).json({ success: false, message: "An error occurred during checkout." });
  }
});

router.get("/safe-checkout", isAuthenticated,checkEmailVerified, async (req, res, next) => {
  res.redirect("/checkout");
});

router.post("/safe-checkout", isAuthenticated, getCartMiddleware, checkEmailVerified, verifyCsrf, async (req, res) => {
  const userId = req.session.userId;
  const fullName = req.session.user.firstname + " " +  req.session.user.lastname;
  const email =  req.session.user.email;
  const {
    cardType,
    quantities,
    ShippingAddress,
    PurchaseDate,
  } = req.body;

  if (!cardType) {
    req.flash("error", "No card type selected");
    return res.redirect("/safe-checkout");
  }

  if (!req.cartItems || req.cartItems.length === 0) {
    return res.status(400).json({ success: false, message: "Your cart is empty." });
  }

  const parsedQuantities = JSON.parse(quantities || "[]");

  try {
    const { findProductByName } = require("../helper_functions/getRating");
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

    // Generate progressive tracking dates
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
    const shipmentDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days
    const deliveryDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000); // 8 days

    // Insert into purchaseditems
    const result = await pool.request()
      .input("TotalPrice", sql.Decimal(10, 2), finalTotalPrice)
      .input("OrderStatus", sql.VarChar, orderStatus)
      .input("ShippingAddress", sql.VarChar, ShippingAddress)
      .input("Quantity", sql.Int, computedQuantity)
      .input("PurchaseDate", sql.DateTime, new Date(PurchaseDate || now))
      .input("UserId", sql.Int, userId)
      .input("PaymentMethod", sql.VarChar, cardType)
      .input("shipping_fee", sql.Decimal(10, 2), shippingFee)
      .input("Discount", sql.Decimal(10, 2), 0.00) // Secure backend-enforced discount
      .input("arrivalDate", sql.DateTime, arrivalDate)
      .input("shipmentDate", sql.DateTime, shipmentDate)
      .input("deliveryDate", sql.DateTime, deliveryDate)
      .query(`
        INSERT INTO purchaseditems (TotalPrice, OrderStatus, ShippingAddress, Quantity, PurchaseDate, UserId, PaymentMethod, shipping_fee, Discount, arrivalDate, shipmentDate, deliveryDate)
        OUTPUT INSERTED.PurchaseID
        VALUES (@TotalPrice, @OrderStatus, @ShippingAddress, @Quantity, @PurchaseDate, @UserId, @PaymentMethod, @shipping_fee, @Discount, @arrivalDate, @shipmentDate, @deliveryDate)
      `);

    const purchaseId = result.recordset[0].PurchaseID;

    // Prepare insert values for `orders` table
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

    // Delete cart items
    await pool.request()
      .input("user_id", sql.Int, userId)
      .query("DELETE FROM cart_items WHERE user_id = @user_id");

    const subject = "Order Confirmation - Acess"; 
    await sendEmail({ to: email, subject, html: html1 });
    await logEmail(userId, fullName, email, "order_placed");

    req.flash("success", "Order is placed. Thanks!");
    return res.status(200).json({ success: true, message: "Payment information updated successfully!" });

  } catch (err) {
    console.error("SQL Error:", err);
    return res.status(500).json({ success: false, message: "An error occurred during checkout." });
  }
});

module.exports = router;