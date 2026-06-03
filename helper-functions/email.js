const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");
const config = require("../config");

const resend = new Resend(config.resendApiKey);

// Helper function to read a template file and throw clean errors if missing
const readTemplate = (fileName) => {
  const filePath = path.join(__dirname, "../email-templates", fileName);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`[EmailModule] Failed to read template file: ${fileName}`, err);
    throw new Error(`[EmailModule] Missing template file: ${fileName}. Please ensure it exists in the email-templates/ directory.`);
  }
};

const isRateLimit = (error) => {
  if (!error) return false;
  return (
    error.status === 429 ||
    error.statusCode === 429 ||
    (error.message && error.message.toLowerCase().includes("rate limit")) ||
    (error.code && error.code === "rate_limit_exceeded") ||
    (error.name && error.name === "RateLimitExceeded")
  );
};

const isAuthError = (error) => {
  if (!error) return false;
  return (
    error.status === 403 ||
    error.statusCode === 403 ||
    (error.message && error.message.toLowerCase().includes("unauthorized")) ||
    (error.message && error.message.toLowerCase().includes("invalid api key"))
  );
};

/**
 * Send Verification Email
 */
const sendVerificationEmail = async ({ to, firstname, verifyUrl }) => {
  try {
    let htmlContent = readTemplate("verification.html");
    
    // Replace placeholders
    htmlContent = htmlContent
      .replace(/{{{firstname}}}/g, firstname)
      .replace(/{{{verifyUrl}}}/g, verifyUrl);

    const data = await resend.emails.send({
      from: "Moda <noreply@modashop.store>",
      to,
      subject: "Please Verify Your Email 📧",
      html: htmlContent,
    });
    return { success: true, data };
  } catch (err) {
    if (isRateLimit(err)) {
      console.error(`[Email:sendVerificationEmail] Failed to send email to unverified customer: ${err.message}`);
      return { success: false, rateLimit: true };
    }
    if (isAuthError(err)) {
      console.error(`[Email:sendVerificationEmail] Failed to send email to unverified customer: Authentication error (403). Check API key.`);
    } else {
      console.error(`[Email:sendVerificationEmail] Failed to send email to unverified customer: ${err.message}`);
    }
    return { success: false, error: true };
  }
};

/**
 * Send Password Reset Email (handles reset link and success confirmation)
 */
const sendPasswordResetEmail = async ({ to, firstname, resetUrl, isConfirmation = false }) => {
  let htmlContent = "";
  let subject = "";
  const recipientType = isConfirmation ? "registered customer (password reset confirmation)" : "registered customer (password reset)";

  try {
    if (isConfirmation) {
      subject = "Password Successfully Reset - Moda 🔑";
      htmlContent = readTemplate("password-updated.html");
      htmlContent = htmlContent.replace(/{{{firstname}}}/g, firstname);
    } else {
      subject = "Reset Your Password - Moda 🔐";
      htmlContent = readTemplate("password-reset.html");
      htmlContent = htmlContent
        .replace(/{{{firstname}}}/g, firstname)
        .replace(/{{{resetUrl}}}/g, resetUrl);
    }

    const data = await resend.emails.send({
      from: "Moda <noreply@modashop.store>",
      to,
      subject,
      html: htmlContent,
    });
    return { success: true, data };
  } catch (err) {
    if (isRateLimit(err)) {
      console.error(`[Email:sendPasswordResetEmail] Failed to send email to ${recipientType}: ${err.message}`);
      return { success: false, rateLimit: true };
    }
    if (isAuthError(err)) {
      console.error(`[Email:sendPasswordResetEmail] Failed to send email to ${recipientType}: Authentication error (403). Check API key.`);
    } else {
      console.error(`[Email:sendPasswordResetEmail] Failed to send email to ${recipientType}: ${err.message}`);
    }
    return { success: false, error: true };
  }
};

/**
 * Send Order Confirmation & Tracking Updates
 */
const sendOrderConfirmationEmail = async ({ to, orderId, type }) => {
  let subject = "";
  let title = "";
  let headerTitle = "";
  let message = "";
  let ctaText = "Track Order";
  const ctaUrl = `${config.baseUrl}/user-profile?tab=orders`;

  if (type === "placed") {
    subject = "Order Confirmation - Moda 🛍️";
    title = "Order Confirmation - Moda";
    headerTitle = "Thank You For Your Order!";
    message = `Your order <strong>#${orderId}</strong> has been received and is currently being processed.<br>We will notify you as soon as your items are prepared and dispatched from our logistics center.`;
  } else if (type === "arrived") {
    subject = "Order Arrived at Warehouse - Moda 📦";
    title = "Order Arrived at Warehouse - Moda";
    headerTitle = "Order Received at Warehouse";
    message = `Your order <strong>#${orderId}</strong> has successfully arrived at our sorting facility and is being prepped for shipment.`;
  } else if (type === "shipped") {
    subject = "Your Order is on the Way - Moda 🚚";
    title = "Your Order is on the Way - Moda";
    headerTitle = "Order Dispatched";
    ctaText = "Track Shipment";
    message = `Great news! Your package for order <strong>#${orderId}</strong> is now shipped and headed your way.`;
  } else if (type === "delivered") {
    subject = "Your Order has been Delivered - Moda ✅";
    title = "Your Order has been Delivered - Moda";
    headerTitle = "Order Delivered";
    ctaText = "View Order";
    message = `Your package for order <strong>#${orderId}</strong> has been successfully delivered. We hope you love your new wardrobe additions!`;
  }

  try {
    let htmlContent = readTemplate("order-status.html");
    htmlContent = htmlContent
      .replace(/{{{title}}}/g, title)
      .replace(/{{{headerTitle}}}/g, headerTitle)
      .replace(/{{{message}}}/g, message)
      .replace(/{{{ctaText}}}/g, ctaText)
      .replace(/{{{ctaUrl}}}/g, ctaUrl);

    const data = await resend.emails.send({
      from: "Moda Orders <orders@modashop.store>",
      to,
      subject,
      html: htmlContent,
    });
    return { success: true, data };
  } catch (err) {
    if (isRateLimit(err)) {
      console.error(`[Email:sendOrderConfirmationEmail] Failed to send email to paying customer (order confirmation): ${err.message}`);
    } else if (isAuthError(err)) {
      console.error(`[Email:sendOrderConfirmationEmail] Failed to send email to paying customer (order confirmation): Authentication error (403). Check API key.`);
    } else {
      console.error(`[Email:sendOrderConfirmationEmail] Failed to send email to paying customer (order confirmation): ${err.message}`);
    }
    // Silently fail and return success: true so the route continues normally
    return { success: true, data: null, warning: true };
  }
};

/**
 * Send Contact Support Emails (Site Owner notification + Customer confirmation)
 */
const sendContactReplyEmail = async ({ firstname, lastname, email, subject, message }) => {
  const senderName = `${firstname} ${lastname}`;

  try {
    // 1. Send support notification to support@modashop.store (Non-critical, wrap in try/catch)
    try {
      let supportHtml = readTemplate("contact-support.html");
      supportHtml = supportHtml
        .replace(/{{{senderName}}}/g, senderName)
        .replace(/{{{senderEmail}}}/g, email)
        .replace(/{{{subject}}}/g, subject)
        .replace(/{{{message}}}/g, message);

      await resend.emails.send({
        from: "Moda Contact <noreply@modashop.store>",
        to: "support@modashop.store",
        reply_to: email,
        subject: subject,
        html: supportHtml,
      });
    } catch (supportErr) {
      if (isRateLimit(supportErr)) {
        console.error(`[Email:sendContactReplyEmail] Failed to send email to support team: ${supportErr.message}`);
      } else if (isAuthError(supportErr)) {
        console.error(`[Email:sendContactReplyEmail] Failed to send email to support team: Authentication error (403). Check API key.`);
      } else {
        console.error(`[Email:sendContactReplyEmail] Failed to send email to support team: ${supportErr.message}`);
      }
    }

    // 2. Send confirmation receipt back to the customer (Non-critical, wrap in try/catch)
    try {
      let confirmHtml = readTemplate("contact-confirmation.html");
      confirmHtml = confirmHtml
        .replace(/{{{firstname}}}/g, firstname)
        .replace(/{{{subject}}}/g, subject);

      await resend.emails.send({
        from: "Moda Support <support@modashop.store>",
        to: email,
        subject: "We received your inquiry - Moda Support 📧",
        html: confirmHtml,
      });
    } catch (confirmErr) {
      if (isRateLimit(confirmErr)) {
        console.error(`[Email:sendContactReplyEmail] Failed to send email to inquiring customer: ${confirmErr.message}`);
      } else if (isAuthError(confirmErr)) {
        console.error(`[Email:sendContactReplyEmail] Failed to send email to inquiring customer: Authentication error (403). Check API key.`);
      } else {
        console.error(`[Email:sendContactReplyEmail] Failed to send email to inquiring customer: ${confirmErr.message}`);
      }
    }

    return { success: true };
  } catch (err) {
    console.error("[EmailModule] sendContactReplyEmail failed:", err);
    return { success: true, warning: true };
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendContactReplyEmail,
};