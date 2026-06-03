const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { pool } = require("../database/data");
const sql = require("mssql");
const crypto = require("crypto");

const config = require("../config");
const baseUrl = config.baseUrl;

// Middlewares
const getUserMiddleware = require("../middleware/get-user");
const getCartMiddleware = require("../middleware/get-cart");
const getWishMiddleware = require("../middleware/get-wishlist");
const getPurchaseMiddleware = require("../middleware/get-purchase");
const isAuthenticated = require("../middleware/is-logged-in");
const redirectIfAuthenticated = require("../middleware/is-allowed");
const { verifyCsrf } = require("../middleware/csrf");

// Cloudinary
const { storage } = require("../cloudinary/cloudinary");
const upload = multer({ storage });

// Email Helpers
const { sendVerificationEmail, sendPasswordResetEmail } = require("../helper-functions/email");
const logEmail = require("../helper-functions/email-logger");
const validateSignupInput = require("../helper-functions/validation");

// Helper function
async function getUserByEmail(email) {
  const result = await pool
    .request()
    .input("email", email)
    .query("SELECT * FROM users WHERE email = @email");

  return result.recordset[0] || null;
}

/* ==========================================================================
   GET ROUTES
   ========================================================================== */

router.get("/signup", getUserMiddleware, getCartMiddleware, getWishMiddleware, getPurchaseMiddleware, redirectIfAuthenticated, (req, res) => {
  const isLoggedIn = !!req.session.user;
  res.status(200).render("auth/signup.ejs", {
    isLoggedIn,
    loggedInUser: req.loggedInUser,
    page: "login",
    cartItemsCount: req.cartItemsCount,
    wishItemsCount: req.wishItemsCount,
    orderCount: req.purchaseCount,
    notificationCount: req.notificationCount || 0,
  });
});

router.get("/login", getUserMiddleware, getCartMiddleware, getWishMiddleware, getPurchaseMiddleware, redirectIfAuthenticated, (req, res) => {
  const isLoggedIn = !!req.session.user;
  res.status(200).render("auth/login", {
    isLoggedIn,
    loggedInUser: req.loggedInUser,
    page: "login",
    cartItemsCount: req.cartItemsCount,
    wishItemsCount: req.wishItemsCount,
    orderCount: req.purchaseCount,
    notificationCount: req.notificationCount || 0,
  });
});

router.get("/logout", (req, res) => {
  delete req.session.returnTo;
  req.flash("success", "Successfully Logged Out!");
  req.session.destroy(() => {
    res.redirect("/home?location=logout");
  });
});

router.get("/verify-email", async (req, res, next) => {
  const { token } = req.query;

  try {
    const tokenResult = await pool
      .request()
      .input("token", token)
      .query("SELECT * FROM email_tokens WHERE token = @token");

    if (tokenResult.recordset.length === 0) {
      return res.status(400).send("Invalid or expired token.");
    }

    const { user_id } = tokenResult.recordset[0];

    await pool
      .request()
      .input("user_id", user_id)
      .query("UPDATE users SET is_verified = 1 WHERE id = @user_id");

    await pool
      .request()
      .input("token", token)
      .query("DELETE FROM email_tokens WHERE token = @token");

    res.status(200).send("✅ Email verified! You can now log in.");
  } catch (err) {
    console.error("[Authentication] Verification error:", err);
    next(err);
  }
});

router.get("/forgot-password", getUserMiddleware, getCartMiddleware, getWishMiddleware, getPurchaseMiddleware, redirectIfAuthenticated, (req, res) => {
  res.status(200).render("auth/forgot-password.ejs", {
    isLoggedIn: false,
    loggedInUser: null,
    page: "login",
    cartItemsCount: req.cartItemsCount,
    wishItemsCount: req.wishItemsCount,
    orderCount: req.purchaseCount,
    notificationCount: req.notificationCount || 0,
  });
});

router.get("/reset-password", getUserMiddleware, getCartMiddleware, getWishMiddleware, getPurchaseMiddleware, redirectIfAuthenticated, async (req, res, next) => {
  const { token } = req.query;
  if (!token) {
    req.flash("error", "❌ Invalid or missing token.");
    return res.redirect("/forgot-password");
  }

  try {
    const result = await pool.request()
      .input("token", sql.VarChar, token)
      .query("SELECT * FROM users WHERE reset_token = @token AND reset_expires > GETDATE()");

    if (result.recordset.length === 0) {
      req.flash("error", "❌ The password reset link is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    res.status(200).render("auth/reset-password.ejs", {
      isLoggedIn: false,
      loggedInUser: null,
      page: "login",
      cartItemsCount: req.cartItemsCount,
      wishItemsCount: req.wishItemsCount,
      orderCount: req.purchaseCount,
      notificationCount: req.notificationCount || 0,
      token,
    });
  } catch (err) {
    console.error("[Authentication] Reset password render crash:", err);
    next(err);
  }
});

/* ==========================================================================
   POST ROUTES
   ========================================================================== */

router.post("/signup", redirectIfAuthenticated, upload.single("img"), async (req, res, next) => {
  try {
    let {
      firstname,
      lastname,
      email,
      Pass,
      phone,
      address,
      city,
      province,
      zip,
    } = req.body;

    firstname = firstname.trim();
    lastname = lastname.trim();
    email = email.trim();
    Pass = Pass ? Pass.trim() : "";
    address = address.trim();
    city = city.trim();
    const imageUrl = req.file?.path || null;

    const { isValid } = validateSignupInput({
      firstname,
      lastname,
      email,
      Pass,
      phone,
      address,
      city,
      zip,
    });

    if (!isValid) {
      return res.status(400).json({ error: "Check input fields for errors." });
    }

    const checkUser = await pool
      .request()
      .input("email", email)
      .query("SELECT email FROM users WHERE email = @email");

    if (checkUser.recordset.length > 0) {
      return res.status(409).json({ error: "⚠️ That email is already registered. Try logging in instead." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(Pass, salt);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hrs
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    try {
      await sendVerificationEmail({ to: email, firstname, verifyUrl });
      req.flash("success", "✅ Verification email sent");
    } catch (emailError) {
      console.error("[Authentication] Email verification send failed:", emailError);
      return res.status(500).json({ error: "❌ Email failed to send." });
    }

    const dateJoined = new Date();

    const result = await pool
      .request()
      .input("firstname", firstname)
      .input("lastname", lastname)
      .input("email", email)
      .input("Pass", hashedPass)
      .input("phone", phone)
      .input("address", address)
      .input("city", city)
      .input("province", province)
      .input("zip", zip)
      .input("img", imageUrl)
      .input("date_joined", dateJoined)
      .query(`
        INSERT INTO users (firstname, lastname, email, Pass, phone, address, city, province, zip, img, date_joined, is_seed)
        OUTPUT INSERTED.id
        VALUES (@firstname, @lastname, @email, @Pass, @phone, @address, @city, @province, @zip, @img, @date_joined, 0)
      `);

    const userId = result.recordset[0].id;

    await pool
      .request()
      .input("user_id", userId)
      .input("token", token)
      .input("expires_at", expiresAt)
      .query(`
        INSERT INTO email_tokens (user_id, token, expires_at)
        VALUES (@user_id, @token, @expires_at)
      `);

    const fullName = `${firstname} ${lastname}`;
    await logEmail(userId, fullName, email, "email verification");

    req.session.user = { firstname, lastname, email };
    req.session.userId = userId;
    req.flash("success", "Successfully registered!");
    req.session.save(() => {
      res.status(201).json({ redirect: "/home" });
    });

  } catch (error) {
    console.error("[Authentication] Signup failed:", error);
    res.status(500).json({ error: "Signup crash. Unexpected error occurred. Try again." });
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, Pass } = req.body;
    const user = await getUserByEmail(email);

    if (!user) {
      if (req.accepts("json")) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      req.flash("error", "Invalid email or password");
      return res.redirect("/login");
    }

    const passwordMatch = await bcrypt.compare(Pass, user.Pass);
    if (!passwordMatch) {
      if (req.accepts("json")) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      req.flash("error", "Invalid email or password");
      return res.redirect("/login");
    }

    req.session.user = user;
    req.session.userId = user.id;
    req.flash("success", "Welcome Back!");
    const redirectUrl = req.session.returnTo || "/home";
    delete req.session.returnTo;

    req.session.save((err) => {
      if (err) {
        console.error("[Authentication] Session save error:", err);
      }
      if (req.accepts("json")) {
        return res.status(200).json({ success: "Welcome Back!", redirect: redirectUrl });
      }
      return res.redirect(redirectUrl);
    });

  } catch (e) {
    console.error("[Authentication] Login failed:", e);
    if (req.accepts("json")) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
    next(e);
  }
});

router.post("/resend-verification", isAuthenticated, async (req, res, next) => {
  const { email } = req.body;
  const fullName = req.session.user.firstname + " " + req.session.user.lastname;

  try {
    const userResult = await pool
      .request()
      .input("email", email)
      .query("SELECT id, firstname FROM Users WHERE email = @email AND is_verified = 0");

    if (userResult.recordset.length === 0) {
      return res.status(400).json({ error: "❌ Invalid or already verified email." });
    }

    const { id: userId, firstname } = userResult.recordset[0];

    const attemptResult = await pool
      .request()
      .input("email", email)
      .input("userId", userId)
      .query(`
        SELECT COUNT(*) AS attempts
        FROM EmailResendAttempts
        WHERE userId = @userId AND attemptAt > DATEADD(HOUR, -24, GETDATE())
      `);

    const attempts = attemptResult.recordset[0].attempts;

    if (attempts >= 3) {
      return res.status(429).json({ error: "⚠️ You have reached your 3 daily resend attempts. Please try again tomorrow." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    await pool
      .request()
      .input("user_id", userId)
      .input("token", token)
      .input("expires_at", expiresAt)
      .query(`
        INSERT INTO email_tokens (user_id, token, expires_at)
        VALUES (@user_id, @token, @expires_at)
      `);

    try {
      await sendVerificationEmail({ to: email, firstname, verifyUrl });
    } catch (emailErr) {
      console.error("[Authentication] Verification email resend failed:", emailErr);
      return res.status(500).json({ error: "❌ Failed to send email. Try again." });
    }

    await pool
      .request()
      .input("userId", userId)
      .input("email", email)
      .query("INSERT INTO EmailResendAttempts (userId, userEmail) VALUES (@userId, @email)");

    await logEmail(userId, fullName, email, "email verification");

    return res.status(200).json({ success: "Verification email sent successfully!" });
  } catch (err) {
    console.error("[Authentication] Resend route error:", err);
    return res.status(500).json({ error: "💥 Server error. Please try again." });
  }
});

router.post("/forgot-password", redirectIfAuthenticated, verifyCsrf, async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      req.flash("error", "❌ That email address is not registered.");
      return res.redirect("/forgot-password");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    await pool.request()
      .input("userId", sql.Int, user.id)
      .input("token", sql.VarChar, token)
      .input("expires", sql.DateTime, expiresAt)
      .query("UPDATE users SET reset_token = @token, reset_expires = @expires WHERE id = @userId");

    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail({ to: email, firstname: user.firstname, resetUrl, isConfirmation: false });

    await logEmail(user.id, `${user.firstname} ${user.lastname}`, email, "password_reset_link");

    req.flash("success", "✅ A password reset link has been sent to your email.");
    return res.redirect("/forgot-password");

  } catch (err) {
    console.error("[Authentication] Forgot password crash:", err);
    req.flash("error", "💥 An error occurred on the server. Please try again.");
    return res.redirect("/forgot-password");
  }
});

router.post("/reset-password", redirectIfAuthenticated, verifyCsrf, async (req, res, next) => {
  const { token, Pass } = req.body;
  if (!token || !Pass) {
    req.flash("error", "❌ All fields are required.");
    return res.redirect(`/reset-password?token=${token}`);
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/;
  if (!passwordRegex.test(Pass.trim())) {
    req.flash("error", "❌ Password must be 8–128 characters, include uppercase, lowercase, numbers, and symbols.");
    return res.redirect(`/reset-password?token=${token}`);
  }

  try {
    const result = await pool.request()
      .input("token", sql.VarChar, token)
      .query("SELECT * FROM users WHERE reset_token = @token AND reset_expires > GETDATE()");

    if (result.recordset.length === 0) {
      req.flash("error", "❌ The password reset link is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    const user = result.recordset[0];
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(Pass.trim(), salt);

    await pool.request()
      .input("userId", sql.Int, user.id)
      .input("Pass", sql.VarChar, hashedPass)
      .query("UPDATE users SET Pass = @Pass, reset_token = NULL, reset_expires = NULL WHERE id = @userId");

    await sendPasswordResetEmail({ to: user.email, firstname: user.firstname, isConfirmation: true });

    await logEmail(user.id, `${user.firstname} ${user.lastname}`, user.email, "password_reset_confirmation");

    req.flash("success", "✅ Password successfully reset! You can now log in.");
    return res.redirect("/login");

  } catch (err) {
    console.error("[Authentication] Reset password POST crash:", err);
    req.flash("error", "💥 An error occurred on the server.");
    return res.redirect(`/reset-password?token=${token}`);
  }
});

module.exports = router;
