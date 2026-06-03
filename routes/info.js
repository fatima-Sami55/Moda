const express = require("express");
const router = express.Router();

// Middlewares
const getUserMiddleware = require("../middleware/get-user");
const getCartMiddleware = require("../middleware/get-cart");
const getWishMiddleware = require("../middleware/get-wishlist");
const getPurchaseMiddleware = require("../middleware/get-purchase");
const isAuthenticated = require("../middleware/is-logged-in");
const checkEmailVerified = require("../middleware/get-email-verification");

// Email Helper
const { sendContactReplyEmail } = require("../helper-functions/email");

/* ==========================================================================
   GET ROUTES
   ========================================================================== */

router.get("/about", getUserMiddleware, getCartMiddleware, getWishMiddleware, getPurchaseMiddleware, (req, res) => {
  const isLoggedIn = !!req.session.user;
  res.status(200).render("about", {
    isLoggedIn,
    loggedInUser: req.loggedInUser,
    page: "about",
    cartItemsCount: req.cartItemsCount,
    wishItemsCount: req.wishItemsCount,
    orderCount: req.purchaseCount,
    notificationCount: req.notificationCount || 0,
  });
});

router.get("/contact", isAuthenticated, checkEmailVerified, getUserMiddleware, getCartMiddleware, getWishMiddleware, getPurchaseMiddleware, (req, res) => {
  const isLoggedIn = !!req.session.user;
  res.status(200).render("contact", {
    isLoggedIn,
    loggedInUser: req.loggedInUser,
    page: "contact",
    cartItemsCount: req.cartItemsCount,
    wishItemsCount: req.wishItemsCount,
    orderCount: req.purchaseCount,
    notificationCount: req.notificationCount || 0,
  });
});

/* ==========================================================================
   POST ROUTES
   ========================================================================== */

router.post("/contact", isAuthenticated, checkEmailVerified, getUserMiddleware, async (req, res, next) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: "❌ Subject and message are required." });
    }

    if (!req.loggedInUser) {
      return res.status(401).json({ error: "🚫 Unauthorized user access." });
    }

    const { firstname, lastname, email } = req.loggedInUser;

    await sendContactReplyEmail({
      firstname,
      lastname,
      email,
      subject,
      message
    });

    return res.status(200).json({ success: "✅ Message successfully sent! Our client team will get back to you shortly." });
  } catch (err) {
    console.error("[InfoRoute] Error dispatching contact form email:", err);
    return res.status(500).json({ error: "🔥 Failed to deliver message. Please try again later." });
  }
});

module.exports = router;
