const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const { pool } = require("../database/data");
const sql = require("mssql");
const baseUrl = process.env.BASE_URL;
const getUserMiddleware = require("../Middleware/get-user");
const getCartMiddleware = require("../Middleware/get-cart");
const getWishMiddleware = require("../Middleware/get-wishlist");
const getPurchaseMiddleware = require("../Middleware/get-purchase");
// getNoticeCount import removed
const transporter = require("../helper-functions/email");
const crypto = require("crypto");
const isAuthenticated = require("../Middleware/is-logged-in");
const logEmail = require("../helper-functions/email-logger");
const validateSignupInput = require("../helper-functions/validation");
const redirectIfAuthenticated = require("../Middleware/is-allowed");
const { storage } = require("../cloudinary/cloudinary");
const upload = multer({ storage });
const { verifyCsrf } = require("../Middleware/csrf");

async function getUserByEmail(email) {
  const result = await pool
    .request()
    .input("email", email)
    .query("SELECT * FROM users WHERE email = @email");

  return result.recordset[0] || null;
}

router.get("/signup",getUserMiddleware,getCartMiddleware,getWishMiddleware,getPurchaseMiddleware,redirectIfAuthenticated,(req, res) => {
    const isLoggedIn = !!req.session.user;
    res.render("auth/signup.ejs", {
      isLoggedIn,
      loggedInUser: req.loggedInUser,
      page: "login",
      cartItemsCount: req.cartItemsCount,
      wishItemsCount: req.wishItemsCount,
      orderCount: req.purchaseCount,
      notificationCount: req.notificationCount || 0,
    });
});

router.post("/signup", redirectIfAuthenticated, upload.single("img"), async (req, res) => {
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

const { isValid, errors } = validateSignupInput({
  firstname,
  lastname,
  email,
  Pass,
  phone,
  address,
  city,
  zip,
});

console.log(req.body)
console.log(imageUrl)


if (!isValid) {
  console.log("Validation errors:", errors);
   return res.json({error: "Check input fields for errors."});
}

    // Check if user already exists
    const checkUser = await pool
      .request()
      .input("email", email)
      .query("SELECT email FROM users WHERE email = @email");

    if (checkUser.recordset.length > 0) {
         console.log("That email is already registered. Try logging in instead.");
         return res.json({error: "⚠️ That email is already registered. Try logging in instead."});
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(Pass, salt);

    // Email verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hrs
     const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    // Send verification email
    try {
      await transporter.sendMail({
        from: `"Moda" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Please Verify Your Email 📧",
        html: `
          <h2>Hey ${firstname},</h2>
          <p>Thanks for signing up! Please verify your email by clicking the button below:</p>
          <p><a href="${verifyUrl}" style="background-color:#4CAF50;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">Verify Email</a></p>
          <p>This link will expire in 24 hours.</p>
        `,
      });
      req.flash("success", "✅ Verification email sent" );
      console.log("✅ Verification email sent to:", email);
    } catch (emailError) {
      console.log("❌ Email failed to send:", emailError);
      return res.json({error: "❌ Email failed to send."});
    }

    // Only now insert into DB
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
        INSERT INTO users (firstname, lastname, email, Pass, phone, address, city, province, zip, img, date_joined)
        OUTPUT INSERTED.id
        VALUES (@firstname, @lastname, @email, @Pass, @phone, @address, @city, @province, @zip, @img, @date_joined)
      `);

    console.log(result)
    const userId = result.recordset[0].id;

    // Save token for verification
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

    // Create session + redirect
    req.session.user = { firstname, lastname, email };
    req.session.userId = userId;
    req.flash("success", "Successfully registered!");
    req.session.save(() => {
    res.json({ redirect: "/home" });
    });


  } catch (error) {
    console.error("🔥 Signup crash:", error);
    console.log("Unexpected error occurred. Try again.");
    res.status(500).json({ error: "Signup crash. Unexpected error occurred. Try again." });
  }
});

router.get("/login",getUserMiddleware,getCartMiddleware,getWishMiddleware,getPurchaseMiddleware,redirectIfAuthenticated,(req, res) => {
    const isLoggedIn = !!req.session.user;
    res.render("auth/login", {
      isLoggedIn,
      loggedInUser: req.loggedInUser,
      page: "login",
      cartItemsCount: req.cartItemsCount,
      wishItemsCount: req.wishItemsCount,
      orderCount: req.purchaseCount,
      notificationCount: req.notificationCount || 0,
    });
});

router.post("/login", async (req, res) => {
  try {
    const { email, Pass } = req.body;
    const user = await getUserByEmail(email);

    if (!user) {
      if (req.accepts("json")) {
        return res.json({ error: "Invalid email or password" });
      }
      req.flash("error", "Invalid email or password");
      return res.redirect("/login");
    }

    const passwordMatch = await bcrypt.compare(Pass, user.Pass);
    if (!passwordMatch) {
      if (req.accepts("json")) {
        return res.json({ error: "Invalid email or password" });
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
        console.error("Session save error:", err);
      }
      if (req.accepts("json")) {
        return res.json({ success: "Welcome Back!", redirect: redirectUrl });
      }
      return res.redirect(redirectUrl);
    });

  } catch (e) {
    console.log("Error:", e);
    if (req.accepts("json")) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
    return res.status(500).send("Internal Server Error");
  }
});

router.get("/logout", (req, res) => {
  delete req.session.returnTo;
  req.flash("success", "Successfully Logged Out!");
  req.session.destroy(() => {
    res.redirect("/home?location=logout");
  });
});

router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  try {
    const tokenResult = await pool
      .request()
      .input("token", token)
      .query("SELECT * FROM email_tokens WHERE token = @token");

    if (tokenResult.recordset.length === 0) {
      return res.send("Invalid or expired token.");
    }

    const { user_id } = tokenResult.recordset[0];

    // Update user's verified status
    await pool
      .request()
      .input("user_id", user_id)
      .query("UPDATE users SET is_verified = 1 WHERE id = @user_id");

    // Delete the token
    await pool
      .request()
      .input("token", token)
      .query("DELETE FROM email_tokens WHERE token = @token");

    res.send("✅ Email verified! You can now log in.");
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).send("Something went wrong.");
  }
});

router.post("/resend-verification", isAuthenticated, async (req, res) => {
  const { email } = req.body;
  const fullName = req.session.user.firstname + " " + req.session.user.lastname;

  try {
    // 1. Check if user exists and is NOT verified
    const userResult = await pool
      .request()
      .input("email", email)
      .query("SELECT id, firstname FROM Users WHERE email = @email AND is_verified = 0");

    if (userResult.recordset.length === 0) {
      return res.json({ error: "❌ Invalid or already verified email." });
    }

    const { id: userId, firstname } = userResult.recordset[0];

    // 2. Count resend attempts (userId + email combo) in the last 24 hours
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
      return res.json({ error: "⚠️ You have reached your 3 daily resend attempts. Please try again tomorrow." });
    }

    // 3. Generate new token
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

    // 4. Send the email
    try {
      await transporter.sendMail({
        from: `"Moda" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Please Verify Your Email 📧",
        html: `
          <h2>Hey ${firstname},</h2>
          <p>Thanks for signing up! Please verify your email by clicking the button below:</p>
          <p><a href="${verifyUrl}" style="background-color:#4CAF50;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">Verify Email</a></p>
          <p>This link will expire in 24 hours.</p>
        `,
      });
      console.log("✅ Verification email re-sent to:", email);
    } catch (emailErr) {
      console.error("❌ Email send error:", emailErr);
      return res.json({ error: "❌ Failed to send email. Try again." });
    }

    // 5. Log the resend attempt
    await pool
      .request()
      .input("userId", userId)
      .input("email", email)
      .query("INSERT INTO EmailResendAttempts (userId, userEmail) VALUES (@userId, @email)");

    await logEmail(userId, fullName, email, "email verification");
      
    return res.json({ success: "Verification email sent successfully!" });
  } catch (err) {
    console.error("❌ Resend route error:", err);
    return res.json({ error: "💥 Server error. Please try again." });
  }
});


router.get("/forgot-password", getUserMiddleware, getCartMiddleware, getWishMiddleware, getPurchaseMiddleware, redirectIfAuthenticated, (req, res) => {
  res.render("auth/forgot-password.ejs", {
    isLoggedIn: false,
    loggedInUser: null,
    page: "login",
    cartItemsCount: req.cartItemsCount,
    wishItemsCount: req.wishItemsCount,
    orderCount: req.purchaseCount,
    notificationCount: req.notificationCount || 0,
  });
});

router.post("/forgot-password", redirectIfAuthenticated, verifyCsrf, async (req, res) => {
  const { email } = req.body;
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      req.flash("error", "❌ That email address is not registered.");
      return res.redirect("/forgot-password");
    }

    // Generate secure reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    // Save token to database
    await pool.request()
      .input("userId", sql.Int, user.id)
      .input("token", sql.VarChar, token)
      .input("expires", sql.DateTime, expiresAt)
      .query("UPDATE users SET reset_token = @token, reset_expires = @expires WHERE id = @userId");

    // Send reset email via GMAIL SMTP config
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: `"Moda" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Reset Your Password - Moda 🔐",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background-color:#f9f9f9;padding:20px;border-radius:10px;border:1px solid #e0e0e0;">
          <h2 style="color:#0f172a;text-align:center;">Password Reset Request</h2>
          <p>Hi ${user.firstname},</p>
          <p>We received a request to reset the password for your account. Please click the button below to set a new password:</p>
          <p style="text-align:center;margin:30px 0;">
            <a href="${resetUrl}" style="background-color:#0f172a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Reset Password</a>
          </p>
          <p>This secure link will expire in <strong>1 hour</strong>.</p>
          <p>If you did not request this change, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;"/>
          <p style="font-size:12px;color:#777;text-align:center;">&copy; ${new Date().getFullYear()} Moda WebApp. All rights reserved.</p>
        </div>
      `,
    });

    await logEmail(user.id, `${user.firstname} ${user.lastname}`, email, "password_reset_link");

    req.flash("success", "✅ A password reset link has been sent to your email.");
    return res.redirect("/forgot-password");

  } catch (err) {
    console.error("Forgot password crash:", err);
    req.flash("error", "💥 An error occurred on the server. Please try again.");
    return res.redirect("/forgot-password");
  }
});

router.get("/reset-password", getUserMiddleware, getCartMiddleware, getWishMiddleware, getPurchaseMiddleware, redirectIfAuthenticated, async (req, res) => {
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

    res.render("auth/reset-password.ejs", {
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
    console.error("Reset password render crash:", err);
    req.flash("error", "💥 Server error. Try again.");
    return res.redirect("/forgot-password");
  }
});

router.post("/reset-password", redirectIfAuthenticated, verifyCsrf, async (req, res) => {
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

    // Send reset confirmation alert
    await transporter.sendMail({
      from: `"Moda" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: "Password Successfully Reset - Moda 🔑",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background-color:#f9f9f9;padding:20px;border-radius:10px;border:1px solid #e0e0e0;">
          <h3 style="color:#0f172a;">Hi ${user.firstname},</h3>
          <p>This email confirms that the password for your Moda account has been successfully reset.</p>
          <p>You can now log in using your new credentials.</p>
          <p style="margin-top:20px;">If you did not make this change, please contact our support team immediately.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;"/>
          <p style="font-size:12px;color:#777;text-align:center;">&copy; ${new Date().getFullYear()} Moda WebApp. All rights reserved.</p>
        </div>
      `,
    });

    await logEmail(user.id, `${user.firstname} ${user.lastname}`, user.email, "password_reset_confirmation");

    req.flash("success", "✅ Password successfully reset! You can now log in.");
    return res.redirect("/login");

  } catch (err) {
    console.error("Reset password POST crash:", err);
    req.flash("error", "💥 An error occurred on the server.");
    return res.redirect(`/reset-password?token=${token}`);
  }
});

module.exports = router;
