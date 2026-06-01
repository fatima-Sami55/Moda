const transporter = require("./email");
require("dotenv").config();

/**
 * Sends a custom email via nodemailer
 * @param {string} to - Receiver email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 * @returns {Promise<boolean>} success
 */
const sendEmail = async ({ to, subject, html }) => {
  console.log(to, subject, html);
  try {
    await transporter.sendMail({
      from: `"Moda" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log("✅ Email sent to:", to);
    return true;
  } catch (err) {
    console.error("❌ Email send error:", err);
    return false;
  }
};

module.exports = sendEmail;
