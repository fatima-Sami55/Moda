const express = require("express");
const router = express.Router();
const getUserMiddleware = require("../Middleware/getUser");
const getCartMiddleware = require("../Middleware/getCart");
const getWishMiddleware = require("../Middleware/getWishlist");
const getPurchaseMiddleware = require("../Middleware/getPurchase");
const isAuthenticated = require("../Middleware/is_logged_in");
const checkEmailVerified = require("../Middleware/getEmailVerification");
const transporter = require("../helper_functions/email");
// getNoticeCount import removed



router.get("/about",getUserMiddleware,getCartMiddleware,getWishMiddleware,getPurchaseMiddleware,(req, res) => {
    const isLoggedIn = req.session.user ? true : false;
    res.render("about", {
      isLoggedIn,
      loggedInUser: req.loggedInUser,
      page: "about",
      cartItemsCount: req.cartItemsCount,
      wishItemsCount: req.wishItemsCount,
      orderCount: req.purchaseCount,
      notificationCount: req.notificationCount || 0,
    });
  }
);

router.get("/contact", isAuthenticated, checkEmailVerified, getUserMiddleware, getCartMiddleware, getWishMiddleware, getPurchaseMiddleware, (req, res) => {
    const isLoggedIn = req.session.user ? true : false;
    res.render("contact", {
      isLoggedIn,
      loggedInUser: req.loggedInUser,
      page: "contact",
      cartItemsCount: req.cartItemsCount,
      wishItemsCount: req.wishItemsCount,
      orderCount: req.purchaseCount,
      notificationCount: req.notificationCount || 0,
    });
  }
);

router.post("/contact", isAuthenticated, checkEmailVerified, getUserMiddleware, async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: "❌ Subject and message are required." });
    }

    if (!req.loggedInUser) {
      return res.status(401).json({ error: "🚫 Unauthorized user access." });
    }

    const { firstname, lastname, email } = req.loggedInUser;

    // Send email via Gmail SMTP to Samifatima975@gmail.com
    await transporter.sendMail({
      from: `"${firstname} ${lastname}" <${process.env.GMAIL_USER}>`,
      replyTo: email,
      to: "Samifatima975@gmail.com",
      subject: `[Moda Contact Form] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 2px solid #1F1E23; background-color: #FFFAF0; border-radius: 0px; box-shadow: 8px 8px 0px #1F1E23;">
          <h2 style="font-family: 'Unbounded', sans-serif; text-transform: uppercase; color: #1F1E23; border-bottom: 3px solid #FE672E; padding-bottom: 15px; margin-top: 0; font-size: 1.5rem;">New Contact Form Message</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #1F1E23;"><strong>Sender Name:</strong> ${firstname} ${lastname}</p>
          <p style="font-size: 15px; line-height: 1.6; color: #1F1E23;"><strong>Verified Email:</strong> <a href="mailto:${email}" style="color: #6A69FF; font-weight: 600; text-decoration: none;">${email}</a></p>
          <p style="font-size: 15px; line-height: 1.6; color: #1F1E23;"><strong>Subject:</strong> ${subject}</p>
          <hr style="border: none; border-top: 2px solid #1F1E23; margin: 20px 0;" />
          <p style="font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #1F1E23; margin-bottom: 8px;">Message Details:</p>
          <div style="background-color: #ffffff; padding: 20px; border: 2px solid #1F1E23; border-radius: 0px; white-space: pre-wrap; font-size: 14px; line-height: 1.7; color: #4A494F;">${message}</div>
        </div>
      `
    });

    console.log(`✉️ Contact message successfully forwarded to Samifatima975@gmail.com from ${email}`);
    return res.status(200).json({ success: "✅ Message successfully sent! Our client team will get back to you shortly." });
  } catch (err) {
    console.error("🔥 Error dispatching contact form email:", err);
    return res.status(500).json({ error: "🔥 Failed to deliver message. Please try again later." });
  }
});


module.exports = router;