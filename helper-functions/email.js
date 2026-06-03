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
    return !!data;
  } catch (err) {
    console.error("[EmailModule] sendVerificationEmail failed:", err);
    throw err;
  }
};

/**
 * Send Password Reset Email (handles reset link and success confirmation)
 */
const sendPasswordResetEmail = async ({ to, firstname, resetUrl, isConfirmation = false }) => {
  let htmlContent = "";
  let subject = "";

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
    return !!data;
  } catch (err) {
    console.error("[EmailModule] sendPasswordResetEmail failed:", err);
    throw err;
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
    return !!data;
  } catch (err) {
    console.error("[EmailModule] sendOrderConfirmationEmail failed:", err);
    throw err;
  }
};

/**
 * Send Contact Reply Email / Admin Notification
 */
const sendContactReplyEmail = async ({ to, subject, message, firstname, lastname, email }) => {
  const mailSubject = `[Moda Contact Form] ${subject}`;
  const senderName = `${firstname} ${lastname}`;

  try {
    let htmlContent = readTemplate("contact-support.html");
    htmlContent = htmlContent
      .replace(/{{{senderName}}}/g, senderName)
      .replace(/{{{senderEmail}}}/g, email)
      .replace(/{{{subject}}}/g, subject)
      .replace(/{{{message}}}/g, message);

    const data = await resend.emails.send({
      from: "Moda Support <support@modashop.store>",
      to,
      replyTo: email,
      subject: mailSubject,
      html: htmlContent,
    });
    return !!data;
  } catch (err) {
    console.error("[EmailModule] sendContactReplyEmail failed:", err);
    throw err;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendContactReplyEmail,
};