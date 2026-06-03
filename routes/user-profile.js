const express = require("express");
const router = express.Router();
const { pool } = require("../database/data");
const sql = require("mssql");
const multer = require("multer");
const bcrypt = require("bcryptjs");

// Middlewares
const getUserMiddleware = require("../middleware/get-user");
const getCartMiddleware = require("../middleware/get-cart");
const getWishMiddleware = require("../middleware/get-wishlist");
const getPurchaseMiddleware = require("../middleware/get-purchase");
const getOrderMiddleware = require("../middleware/get-orders");
const isAuthenticated = require("../middleware/is-logged-in");
const { verifyCsrf } = require("../middleware/csrf");

// Cloudinary
const { storage } = require("../cloudinary/cloudinary");
const upload = multer({ storage });

// Email Helpers
const { sendOrderConfirmationEmail } = require("../helper-functions/email");
const logEmail = require("../helper-functions/email-logger");
const validateSignupInput = require("../helper-functions/validation");
const { getCurrentNotifications } = require("../helper-functions/time-based-update");

function sanitizeSession() {
  const delSql = `DELETE FROM sessions WHERE JSON_VALUE(data, '$.userId') IS NULL`;
  pool.request().query(delSql).then(() => {
  }).catch((err) => {
    console.error("[UserProfile] Error deleting sessions:", err);
  });
}

/* ==========================================================================
   GET ROUTES
   ========================================================================== */

router.get("/user-profile", isAuthenticated, getUserMiddleware, getWishMiddleware, getCartMiddleware, getPurchaseMiddleware, getOrderMiddleware, async (req, res, next) => {
  const userId = req.session.userId;
  const email = req.loggedInUser.email;
  const fullName = req.loggedInUser.firstname + " " + req.loggedInUser.lastname;
  const currentDate = new Date();

  const statusPriority = {
    "Placed": 0,
    "arrived": 1,
    "shipped": 2,
    "delivered": 3,
    "reviewed": 4,
  };

  try {
    if (req.purchase) {
      for (const orderData of req.purchase) {
        const id = orderData.PurchaseID;
        const previousStatus = orderData.OrderStatus || "Placed";
        const currentPriority = statusPriority[previousStatus] || 0;
        let newStatus = previousStatus;

        if (orderData.deliveryDate && currentDate >= new Date(orderData.deliveryDate) && currentPriority < statusPriority["delivered"]) {
          newStatus = "delivered";
          await sendOrderConfirmationEmail({ to: email, orderId: id, type: "delivered" }).catch(err => console.error(err));
          await logEmail(userId, fullName, email, "order delivery").catch(err => console.error(err));
        } else if (orderData.shipmentDate && currentDate >= new Date(orderData.shipmentDate) && currentPriority < statusPriority["shipped"]) {
          newStatus = "shipped";
          await sendOrderConfirmationEmail({ to: email, orderId: id, type: "shipped" }).catch(err => console.error(err));
          await logEmail(userId, fullName, email, "order shipment").catch(err => console.error(err));
        } else if (orderData.arrivalDate && currentDate >= new Date(orderData.arrivalDate) && currentPriority < statusPriority["arrived"]) {
          newStatus = "arrived";
          await sendOrderConfirmationEmail({ to: email, orderId: id, type: "arrived" }).catch(err => console.error(err));
          await logEmail(userId, fullName, email, "order arrival at warehouse").catch(err => console.error(err));
        }

        if (newStatus !== previousStatus) {
          await pool.request()
            .input("OrderStatus", sql.VarChar, newStatus)
            .input("PurchaseID", sql.Int, id)
            .query(`
              UPDATE purchaseditems 
              SET OrderStatus = CASE 
                                  WHEN OrderStatus != 'reviewed' THEN @OrderStatus 
                                  ELSE OrderStatus 
                                END 
              WHERE PurchaseID = @PurchaseID
            `).catch(err => console.error(err));
          orderData.OrderStatus = newStatus;

          let notifMessage = "";
          if (newStatus === "arrived") {
            notifMessage = `Order #${id} has arrived at our warehouse.`;
          } else if (newStatus === "shipped") {
            notifMessage = `Order #${id} has been shipped.`;
          } else if (newStatus === "delivered") {
            notifMessage = `Order #${id} has been delivered successfully.`;
          }

          if (notifMessage) {
            try {
              await pool.request()
                .input("user_id", sql.Int, userId)
                .input("message", sql.NVarChar(500), notifMessage)
                .query(`
                  INSERT INTO notifications (user_id, message)
                  SELECT @user_id, @message
                  WHERE NOT EXISTS (
                    SELECT 1 FROM notifications WHERE message = @message AND user_id = @user_id
                  )
                `);
              await getCurrentNotifications(userId);
            } catch (err) {
              console.error("[UserProfile] Error inserting notification:", err);
            }
          }
        }
      }
    }

    const formatDate = (date) => {
      if (!date) return "";
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const month = monthNames[date.getMonth()];
      const day = String(date.getDate()).padStart(2, "0");
      const year = date.getFullYear();
      let hours = date.getHours();
      const period = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${month} ${day} ${year}  ${hours}:${minutes} ${period}`;
    };

    const datesData = {};
    if (req.purchase) {
      req.purchase.forEach(pu => {
        datesData[pu.PurchaseID] = {
          placement: formatDate(pu.PurchaseDate),
          arrival: formatDate(pu.arrivalDate),
          shipment: formatDate(pu.shipmentDate),
          delivery: formatDate(pu.deliveryDate),
        };
      });
    }

    const pendingReviewsResult = await pool.request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT 
          o.id,
          o.itemName,
          o.itemDescription,
          o.item_img,
          o.quantity,
          o.item_price,
          o.user_id,
          o.purchase_id,
          p.purchasedItemId
        FROM orders o
        JOIN purchasedItems p ON o.purchase_id = p.PurchaseID
        WHERE p.orderStatus = 'delivered' 
          AND o.user_id = @user_id
          AND o.review_status = 0
      `);

    const submittedReviewsResult = await pool.request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT * FROM reviews 
        WHERE user_id = @user_id 
        ORDER BY id DESC
      `);

    const wishlistResult = await pool.request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT * FROM wish_items 
        WHERE user_id = @user_id
      `);

    const emailLogsResult = await pool.request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT * FROM EmailLogs
        WHERE userId = @user_id
        ORDER BY sentAt DESC
      `);

    const notificationsResult = await pool.request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT * FROM notifications
        WHERE user_id = @user_id
        ORDER BY id DESC
      `);

    const attemptResult = await pool.request()
      .input("email", sql.VarChar, email)
      .input("userId", sql.Int, userId)
      .query(`
        SELECT COUNT(*) AS attempts
        FROM EmailResendAttempts
        WHERE userId = @userId
        AND attemptAt > DATEADD(HOUR, -24, GETDATE())
      `);

    const attempts = attemptResult.recordset[0].attempts;

    const stats = {
      orders: req.purchaseCount,
      wishlist: wishlistResult.recordset.length,
      reviews: submittedReviewsResult.recordset.length,
      notifications: notificationsResult.recordset.length,
    };
    
    res.status(200).render("user", {
      loggedInUser: req.loggedInUser,
      page: "user",
      stats,
      isVerified: req.loggedInUser ? req.loggedInUser.is_verified === true : true,
      resendAttempts: attempts, 
      email: email,
      purchases: req.purchase || [],
      pendingReviews: pendingReviewsResult.recordset || [],
      submittedReviews: submittedReviewsResult.recordset || [],
      wishlist: wishlistResult.recordset || [],
      emailLogs: emailLogsResult.recordset || [],
      notifications: notificationsResult.recordset || [],
      orders: req.orders || [],
      data: datesData,
      currentDate,
    });
  } catch (err) {
    console.error("[UserProfile] Error fetching profile stats:", err);
    next(err);
  }
});

/* ==========================================================================
   POST ROUTES
   ========================================================================== */

router.post("/edit-profile", isAuthenticated, upload.single("img"), verifyCsrf, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const {
      firstname = "", lastname = "", email = "", Pass = "",
      phone = "", address = "", city = "", province = "", zip = ""
    } = req.body;

    const userCheck = await pool.request()
      .input("id", sql.Int, userId)
      .query("SELECT * FROM users WHERE id = @id");

    if (userCheck.recordset.length !== 1) {
      return res.status(404).json({ error: "User not found or unauthorized" });
    }

    const currentUser = userCheck.recordset[0];

    const checkEmail = await pool.request()
      .input("email", sql.VarChar, email.trim())
      .query("SELECT id FROM users WHERE email = @email");

    if (checkEmail.recordset.length > 0 && checkEmail.recordset[0].id !== userId) {
      return res.status(409).json({ error: "That email is already registered. Try logging in instead." });
    }

    let finalPassword = currentUser.Pass;
    if (Pass && Pass.trim()) {
      finalPassword = await bcrypt.hash(Pass.trim(), 10);
    }

    const imgPath = req.file
      ? req.file.path.replace(/\\/g, "/").replace("public/", "")
      : currentUser.img;

    const { isValid } = validateSignupInput({
      firstname, lastname, email, Pass, phone, address, city, zip
    }, true);

    if (!isValid) {
      return res.status(400).json({ error: "Validation failed. Check your inputs." });
    }

    await pool.request()
      .input("id", sql.Int, userId)
      .input("firstname", sql.VarChar, firstname.trim())
      .input("lastname", sql.VarChar, lastname.trim())
      .input("email", sql.VarChar, email.trim())
      .input("Pass", sql.VarChar, finalPassword)
      .input("phone", sql.VarChar, phone.trim())
      .input("address", sql.VarChar, address.trim())
      .input("city", sql.VarChar, city.trim())
      .input("province", sql.VarChar, province.trim())
      .input("zip", sql.VarChar, zip.trim())
      .input("img", sql.VarChar, imgPath)
      .query(`
        UPDATE users SET
          firstname = @firstname,
          lastname = @lastname,
          email = @email,
          Pass = @Pass,
          phone = @phone,
          address = @address,
          city = @city,
          province = @province,
          zip = @zip,
          img = @img
        WHERE id = @id
      `);

    req.session.user = {
      ...currentUser,
      firstname, lastname, email, phone, address, city, province, zip, img: imgPath
    };

    return res.status(200).json({ status: "success", redirect: "/user-profile" });

  } catch (err) {
    console.error("[UserProfile] Profile update error:", err);
    return res.status(500).json({ error: "Something went wrong on the server." });
  }
});

/* ==========================================================================
   DELETE ROUTES
   ========================================================================== */

router.delete("/user-profile", isAuthenticated, verifyCsrf, async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) return res.redirect("/home");

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    
    const request = new sql.Request(transaction);
    request.input("user_id", sql.Int, userId);
    
    await request.query("DELETE FROM email_tokens WHERE user_id = @user_id");
    await request.query("DELETE FROM EmailResendAttempts WHERE userId = @user_id");
    await request.query("DELETE FROM EmailLogs WHERE userId = @user_id");
    await request.query("DELETE FROM notifications WHERE user_id = @user_id");
    await request.query("DELETE FROM wish_items WHERE user_id = @user_id");
    await request.query("DELETE FROM cart_items WHERE user_id = @user_id");
    await request.query("DELETE FROM reviews WHERE user_id = @user_id");
    await request.query("DELETE FROM orders WHERE user_id = @user_id");
    await request.query("DELETE FROM purchaseditems WHERE UserId = @user_id");
    
    await request.query("DELETE FROM users WHERE id = @user_id");
    
    await transaction.commit();
    
    sanitizeSession();
    req.session.destroy((err) => {
      if (err) {
        console.error("[UserProfile] Error destroying session:", err);
        return res.status(500).send("Failed to delete session.");
      }
      res.redirect("/home");
    });
  } catch (err) {
    console.error("[UserProfile] Error deleting user transaction:", err);
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      console.error("[UserProfile] Failed to rollback delete transaction:", rollbackErr);
    }
    next(err);
  }
});

module.exports = router;
