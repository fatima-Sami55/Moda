const express = require("express");
const router = express.Router();
const { pool } = require("../database/data");
const sql = require("mssql");
const getUserMiddleware = require("../middleware/get-user");
const getPurchaseMiddleware = require("../middleware/get-purchase");
const getOrderMiddleware = require("../middleware/get-orders");
const isAuthenticated = require("../middleware/is-logged-in");
const checkEmailVerified = require("../middleware/get-email-verification");
const { verifyCsrf } = require("../middleware/csrf");
const logEmail = require("../helper-functions/email-logger");
const sendEmail = require("../helper-functions/email-writer");
const {html2, html3, html4} = require("../helper-functions/email-messages");
const {
  getCurrentNotifications,
} = require("../helper-functions/time-based-update");

router.get("/orders", isAuthenticated, checkEmailVerified, (req, res) => {
  res.redirect("/user-profile?tab=orders");
});

router.get("/track-order", isAuthenticated, checkEmailVerified, (req, res) => {
  const id = req.query.purchase_id;
  if (id) {
    res.redirect(`/user-profile?track=${id}`);
  } else {
    res.redirect("/user-profile?tab=orders");
  }
});


router.post("/cancel-order", isAuthenticated, checkEmailVerified, verifyCsrf, async (req, res) => {
  const { PurchaseID } = req.body;
  const userID = req.session.userId;

  try {
    // 1. Fetch purchase record, enforcing user ownership
    const purchaseResult = await pool.request()
      .input("PurchaseID", sql.Int, PurchaseID)
      .input("UserID", sql.Int, userID)
      .query("SELECT * FROM purchaseditems WHERE PurchaseID = @PurchaseID AND userID = @UserID");

    if (purchaseResult.recordset.length === 0) {
      return res.json({ success: false, message: "Order not found." });
    }

    const orderData = purchaseResult.recordset[0];

    // Check if order already shipped or delivered
    const status = (orderData.OrderStatus || 'placed').toLowerCase();
    if (status === 'shipped' || status === 'delivered' || (orderData.shipmentDate && new Date() >= new Date(orderData.shipmentDate))) {
      return res.json({
        success: false,
        message: "Cannot cancel order. It has already shipped.",
      });
    }

    // Delete from purchaseditems
    const deletePurchaseResult = await pool.request()
      .input("PurchaseID", sql.Int, PurchaseID)
      .input("UserID", sql.Int, userID)
      .query("DELETE FROM purchaseditems WHERE PurchaseID = @PurchaseID AND userID = @UserID");

    if (deletePurchaseResult.rowsAffected[0] > 0) {
      // Delete from orders table
      await pool.request()
        .input("PurchaseID", sql.Int, PurchaseID)
        .input("UserID", sql.Int, userID)
        .query("DELETE FROM orders WHERE purchase_id = @PurchaseID AND user_id = @UserID");

      req.flash("success", "Order cancelled successfully!");
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Order not found or already deleted." });
    }
  } catch (err) {
    console.error("Database error:", err);
    res.json({ success: false, message: "Database error." });
  }
});

router.get("/inbox", isAuthenticated, checkEmailVerified, (req, res) => {
  res.redirect("/user-profile?tab=inbox");
});

router.post("/delete-notification", isAuthenticated, checkEmailVerified, verifyCsrf, async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.body;

  try {
    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("user_id", sql.Int, userId)
      .query("DELETE FROM notifications WHERE id = @id AND user_id = @user_id");

    console.log("Notification deleted:", result.rowsAffected);
    
    // Fetch updated notification list and emit count to client
    const countResult = await pool.request()
      .input("user_id", sql.Int, userId)
      .query("SELECT COUNT(*) AS count FROM notifications WHERE user_id = @user_id");
    const count = countResult.recordset[0].count;

    res.json({ success: true, notificationCount: count });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }

  getCurrentNotifications(userId); 
});

router.post("/delete-all", isAuthenticated, checkEmailVerified, verifyCsrf, async (req, res) => {
  const userId = req.session.userId;

  try {
    const result = await pool.request()
      .input("user_id", sql.Int, userId)
      .query("DELETE FROM notifications WHERE user_id = @user_id");

    console.log("All notifications deleted:", result.rowsAffected);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }

  getCurrentNotifications(userId); 
});

router.get("/review", isAuthenticated, checkEmailVerified, (req, res) => {
  res.redirect("/user-profile?tab=reviews");
});

router.post("/review", isAuthenticated, checkEmailVerified, verifyCsrf, async (req, res) => {
  const { review, rating, id, productName, purchasedItemId } = req.body;
  const userId = req.session.userId;

  try {
    // IDOR Check: Ensure this order item actually belongs to the user
    const checkOrder = await pool.request()
      .input("id", sql.Int, id)
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM orders WHERE id = @id AND user_id = @userId");

    if (checkOrder.recordset.length === 0) {
      return res.status(403).send("Unauthorized review request");
    }

    // Step 1: Insert into reviews
    const insertResult = await pool.request()
      .input("rating", sql.Int, rating)
      .input("review", sql.Text, review)
      .input("user_id", sql.Int, userId)
      .input("order_id", sql.Int, id)
      .input("product_name", sql.VarChar, productName)
      .input("purchasedItemId", sql.UniqueIdentifier, purchasedItemId)
      .query(`
        INSERT INTO reviews (rating, review, user_id, order_id, product_name, PurchasedItemID)
        VALUES (@rating, @review, @user_id, @order_id, @product_name, @purchasedItemId)
      `);

    if (insertResult.rowsAffected[0] === 0) {
      return res.status(500).send("Failed to insert review");
    }

    // Step 2: Mark that specific item as reviewed
    await pool.request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE orders
        SET review_status = 1
        WHERE id = @id
      `);

    // Step 3: Check if all items in the same purchase are now reviewed
    const purchaseIdResult = await pool.request()
      .input("id", sql.Int, id)
      .query(`SELECT purchase_id FROM orders WHERE id = @id`);

    const purchaseId = purchaseIdResult.recordset[0].purchase_id;

    const totalItemsResult = await pool.request()
      .input("purchase_id", sql.Int, purchaseId)
      .query(`
        SELECT COUNT(*) AS total FROM orders WHERE purchase_id = @purchase_id
      `);

    const reviewedItemsResult = await pool.request()
      .input("purchase_id", sql.Int, purchaseId)
      .query(`
        SELECT COUNT(*) AS reviewed FROM orders 
        WHERE purchase_id = @purchase_id AND review_status = 1
      `);

    const total = totalItemsResult.recordset[0].total;
    const reviewed = reviewedItemsResult.recordset[0].reviewed;

    // Step 4: If all reviewed, update the main purchase status
    if (total === reviewed) {
      await pool.request()
        .input("purchasedItemId", sql.UniqueIdentifier, purchasedItemId)
        .query(`
          UPDATE purchaseditems 
          SET OrderStatus = 'reviewed'
          WHERE PurchasedItemID = @purchasedItemId
        `);
    }

    // All done
    req.flash("success", "Review submitted successfully!");
    res.status(200).send("Review submitted successfully");

  } catch (error) {
    console.error("❌ Error in POST /review:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.delete("/review", isAuthenticated, verifyCsrf, async (req, res) => {
  const { orderId, purchasedItemId } = req.body;
  const userId = req.session.userId;

  try {
    // IDOR Check: Ensure this order item actually belongs to the user
    const checkOrder = await pool.request()
      .input("orderId", sql.Int, orderId)
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM orders WHERE id = @orderId AND user_id = @userId");

    if (checkOrder.recordset.length === 0) {
      return res.status(403).json({ error: "Unauthorized review deletion request" });
    }

    // Step 1: Set review_status = 0 for this order item
    await pool.request()
      .input("orderId", sql.Int, orderId)
      .query(`
        UPDATE orders
        SET review_status = 0
        WHERE id = @orderId
      `);

    // Step 2: Delete the actual review from `reviews` table
    await pool.request()
      .input("order_id", sql.Int, orderId)
      .query(`
        DELETE FROM reviews
        WHERE order_id = @order_id
      `);

    // Step 3: Check if ALL items in the purchase are now unreviewed
     const purchaseIdResult = await pool.request()
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT purchase_id FROM orders WHERE id = @orderId
      `);

    if (!purchaseIdResult.recordset.length) {
      console.error("❌ Order not found with id:", orderId);
      return res.status(404).json({ error: "Order not found. Cannot continue." });
    }

    const purchaseId = purchaseIdResult.recordset[0].purchase_id;

    const totalItemsResult = await pool.request()
      .input("purchaseId", sql.Int, purchaseId)
      .query(`SELECT COUNT(*) AS total FROM orders WHERE purchase_id = @purchaseId`);

    const reviewedItemsResult = await pool.request()
      .input("purchaseId", sql.Int, purchaseId)
      .query(`SELECT COUNT(*) AS reviewed FROM orders WHERE purchase_id = @purchaseId AND review_status = 1`);

    const total = totalItemsResult.recordset[0].total;
    const reviewed = reviewedItemsResult.recordset[0].reviewed;

    // Step 4: If NO items are reviewed, revert purchase status back to 'delivered'
    if (reviewed === 0) {
      await pool.request()
        .input("purchasedItemId", sql.UniqueIdentifier, purchasedItemId)
        .query(`
          UPDATE purchasedItems
          SET OrderStatus = 'delivered'
          WHERE PurchasedItemID = @purchasedItemId
        `);
    }

    req.flash("success", "Review removed successfully!");
    res.status(200).json({ message: "Review removed successfully" });

  } catch (err) {
    console.error("❌ Delete review error:", err);
    req.flash("error", "Delete Review Error!");
    res.status(500).json({ error: "Failed to delete review" });
  }
});

router.get("/email", isAuthenticated, (req, res) => {
  res.redirect("/user-profile?tab=email");
});

module.exports = router;