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

  const expiredHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verification Link Expired</title>
      <style>
        body { background-color: #FFFAF0; font-family: sans-serif; color: #1F1E23; text-align: center; padding: 50px 10px; }
        .card { max-width: 500px; margin: 0 auto; background: #FFF5EA; border: 4px solid #1F1E23; padding: 40px; box-shadow: 8px 8px 0 #1F1E23; text-align: left; }
        h2 { font-size: 24px; text-transform: uppercase; margin-bottom: 20px; text-align: center; }
        p { color: #4A494F; line-height: 1.6; font-size: 16px; margin-bottom: 25px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; font-weight: bold; margin-bottom: 8px; }
        input[type="email"] { width: 100%; padding: 12px; border: 3px solid #1F1E23; box-sizing: border-box; font-size: 16px; }
        .btn { display: block; width: 100%; padding: 12px; background-color: #FE672E; color: #1F1E23; border: 3px solid #1F1E23; box-shadow: 4px 4px 0 #1F1E23; text-transform: uppercase; font-weight: bold; font-size: 16px; cursor: pointer; text-align: center; text-decoration: none; margin-top: 10px; }
        .btn:hover { background-color: #ff8552; }
        .alert { padding: 15px; border: 3px solid #1F1E23; margin-bottom: 20px; display: none; font-weight: bold; }
        .alert-success { background-color: #d4edda; color: #155724; }
        .alert-danger { background-color: #f8d7da; color: #721c24; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Link Expired or Invalid</h2>
        <p>This verification link is invalid or has expired (verification links are valid for 24 hours).</p>
        
        <div id="alert-msg" class="alert"></div>

        <form id="resend-form">
          <div class="form-group">
            <label for="email">Enter your email to request a new verification link:</label>
            <input type="email" id="email" name="email" placeholder="Enter your email address" required>
          </div>
          <button type="submit" class="btn">Resend Verification Email</button>
        </form>
        <a href="/login" class="btn" style="background-color: transparent; margin-top: 20px;">Back to Login</a>
      </div>

      <script>
        document.getElementById('resend-form').addEventListener('submit', function(e) {
          e.preventDefault();
          const email = document.getElementById('email').value;
          const btn = e.target.querySelector('button');
          const alertDiv = document.getElementById('alert-msg');
          
          btn.disabled = true;
          btn.innerText = 'Sending...';
          alertDiv.style.display = 'none';

          fetch('/resend-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          })
          .then(response => response.json())
          .then(data => {
            if (data.error) {
              alertDiv.className = 'alert alert-danger';
              alertDiv.innerText = data.error;
              alertDiv.style.display = 'block';
            } else {
              alertDiv.className = 'alert alert-success';
              alertDiv.innerText = data.success;
              alertDiv.style.display = 'block';
              document.getElementById('resend-form').reset();
            }
            btn.disabled = false;
            btn.innerText = 'Resend Verification Email';
          })
          .catch(err => {
            alertDiv.className = 'alert alert-danger';
            alertDiv.innerText = 'An error occurred. Please try again.';
            alertDiv.style.display = 'block';
            btn.disabled = false;
            btn.innerText = 'Resend Verification Email';
          });
        });
      </script>
    </body>
    </html>
  `;

  try {
    const tokenResult = await pool
      .request()
      .input("token", token)
      .query("SELECT * FROM email_tokens WHERE token = @token");

    if (tokenResult.recordset.length === 0) {
      return res.status(400).send(expiredHtml);
    }

    const dbToken = tokenResult.recordset[0];
    if (new Date(dbToken.expires_at) < new Date()) {
      // Invalidate the expired token by deleting it
      await pool
        .request()
        .input("token", token)
        .query("DELETE FROM email_tokens WHERE token = @token");

      return res.status(400).send(expiredHtml);
    }

    const { user_id } = dbToken;

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
      .query("SELECT id, email, is_verified FROM users WHERE email = @email");

    if (checkUser.recordset.length > 0) {
      const existingUser = checkUser.recordset[0];
      if (!existingUser.is_verified) {
        const tokenResult = await pool
          .request()
          .input("userId", existingUser.id)
          .query("SELECT * FROM email_tokens WHERE user_id = @userId");

        if (tokenResult.recordset.length > 0) {
          const existingToken = tokenResult.recordset[0];
          if (existingToken.created_at) {
            const timeDiff = Date.now() - new Date(existingToken.created_at).getTime();
            if (timeDiff < 24 * 60 * 60 * 1000) {
              return res.status(429).json({ error: "A verification email was already sent. Please wait 24 hours before requesting another or check your spam folder." });
            }
          }
        }
      }
      return res.status(409).json({ error: "⚠️ That email is already registered. Try logging in instead." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(Pass, salt);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hrs
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    const emailResult = await sendVerificationEmail({ to: email, firstname, verifyUrl });
    if (!emailResult.success) {
      if (emailResult.rateLimit) {
        return res.status(429).json({ error: "Our email service is temporarily unavailable. Please try again in a few minutes." });
      } else {
        return res.status(500).json({ error: "Something went wrong while sending the email. Please try again shortly." });
      }
    }
    req.flash("success", "✅ Verification email sent");

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
      .input("created_at", new Date())
      .query(`
        INSERT INTO email_tokens (user_id, token, expires_at, created_at)
        VALUES (@user_id, @token, @expires_at, @created_at)
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

router.post("/resend-verification", async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "❌ Email is required." });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const userResult = await pool
      .request()
      .input("email", cleanEmail)
      .query("SELECT id, firstname, lastname, is_verified FROM users WHERE email = @email");

    // Secure generic message to prevent email harvesting/enumeration
    const genericSuccessResponse = { success: "If an account with that email exists, you will receive an email shortly." };

    if (userResult.recordset.length === 0) {
      console.log(`[Resend Verification Alert] Non-existent email resend attempt: ${cleanEmail}`);
      return res.status(200).json(genericSuccessResponse);
    }

    const user = userResult.recordset[0];

    if (user.is_verified) {
      console.log(`[Resend Verification Alert] Already verified email resend attempt: ${cleanEmail}`);
      return res.status(200).json(genericSuccessResponse);
    }

    // Check rate limit: 1 verification email every 24 hours
    const tokenResult = await pool
      .request()
      .input("userId", user.id)
      .query("SELECT * FROM email_tokens WHERE user_id = @userId");

    if (tokenResult.recordset.length > 0) {
      const existingToken = tokenResult.recordset[0];
      if (existingToken.created_at) {
        const timeDiff = Date.now() - new Date(existingToken.created_at).getTime();
        if (timeDiff < 24 * 60 * 60 * 1000) {
          return res.status(429).json({ error: "A verification email was already sent. Please wait 24 hours before requesting another or check your spam folder." });
        }
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const createdAt = new Date();
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    const emailResult = await sendVerificationEmail({ to: cleanEmail, firstname: user.firstname, verifyUrl });
    if (!emailResult.success) {
      if (emailResult.rateLimit) {
        return res.status(429).json({ error: "Our email service is temporarily unavailable. Please try again in a few minutes." });
      } else {
        return res.status(500).json({ error: "Something went wrong while sending the email. Please try again shortly." });
      }
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const request = new sql.Request(transaction);
      await request.input("userId", sql.Int, user.id)
                   .query("DELETE FROM email_tokens WHERE user_id = @userId");

      await request.input("user_id", sql.Int, user.id)
                   .input("token", sql.VarChar, token)
                   .input("expires_at", sql.DateTime, expiresAt)
                   .input("created_at", sql.DateTime, createdAt)
                   .query(`
                     INSERT INTO email_tokens (user_id, token, expires_at, created_at)
                     VALUES (@user_id, @token, @expires_at, @created_at)
                   `);
      await transaction.commit();
    } catch (dbErr) {
      await transaction.rollback();
      throw dbErr;
    }

    const fullName = `${user.firstname} ${user.lastname}`;
    await logEmail(user.id, fullName, cleanEmail, "email verification");

    return res.status(200).json(genericSuccessResponse);
  } catch (err) {
    console.error("[Authentication] Resend route error:", err);
    return res.status(500).json({ error: "💥 Server error. Please try again." });
  }
});

router.post("/forgot-password", redirectIfAuthenticated, verifyCsrf, async (req, res, next) => {
  const { email } = req.body;
  const genericResponse = "If an account with that email exists, you will receive an email shortly.";

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      console.log(`[Forgot Password Alert] Non-existent email reset attempt: ${email}`);
      req.flash("success", genericResponse);
      return res.redirect("/forgot-password");
    }

    // Rate Limit: 1 password reset request every 12 hours
    const now = new Date();
    if (user.reset_token && user.reset_expires && new Date(user.reset_expires) > now) {
      if (user.reset_requested_at) {
        const timeDiff = now.getTime() - new Date(user.reset_requested_at).getTime();
        if (timeDiff < 12 * 60 * 60 * 1000) {
          req.flash("error", "A password reset link was already sent to your email. Please wait 12 hours before requesting another.");
          return res.redirect("/forgot-password");
        }
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours expiration
    const requestedAt = new Date();
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Attempt to send email first before writing to database
    const emailResult = await sendPasswordResetEmail({ to: email, firstname: user.firstname, resetUrl, isConfirmation: false });
    if (!emailResult.success) {
      if (emailResult.rateLimit) {
        req.flash("error", "Our email service is temporarily unavailable. Please try again in a few minutes.");
      } else {
        req.flash("error", "Something went wrong while sending the email. Please try again shortly.");
      }
      return res.redirect("/forgot-password");
    }

    // Email succeeded. Now write token to database
    await pool.request()
      .input("userId", sql.Int, user.id)
      .input("token", sql.VarChar, token)
      .input("expires", sql.DateTime, expiresAt)
      .input("requestedAt", sql.DateTime, requestedAt)
      .query("UPDATE users SET reset_token = @token, reset_expires = @expires, reset_requested_at = @requestedAt WHERE id = @userId");

    await logEmail(user.id, `${user.firstname} ${user.lastname}`, email, "password_reset_link");

    req.flash("success", genericResponse);
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

    const emailResult = await sendPasswordResetEmail({ to: user.email, firstname: user.firstname, isConfirmation: true });
    if (!emailResult.success) {
      console.warn(`[Authentication] Password reset confirmation email failed to send: rateLimit=${emailResult.rateLimit}, error=${emailResult.error}`);
    }

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
