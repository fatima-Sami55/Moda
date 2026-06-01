const html1 = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0;">
    <div style="text-align: center; padding-bottom: 20px;">
      <h2 style="color: #4CAF50;">Thank you for your order! 🛍️</h2>
      <p style="color: #555;">This email confirms that we've received your order.</p>
    </div>

    <div style="background-color: #ffffff; padding: 20px; border-radius: 8px;">
      <h3 style="color: #333;">🧾 Order Summary</h3>
      <p><strong>Order ID:</strong> <span style="color: #4CAF50;">#123456</span></p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>Status:</strong> Processing</p>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />

      <p style="color: #555;">We will notify you once your order has been shipped. You can track the status of your order anytime in your profile dashboard.</p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="http://localhost:3000/orders" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View My Order</a>
    </div>

    <div style="margin-top: 30px; font-size: 14px; color: #777; text-align: center;">
      <p>If you have any questions, just reply to this email—we’re happy to help.</p>
      <p>&copy; ${new Date().getFullYear()} Moda. All rights reserved.</p>
    </div>
  </div>
    `;

const html2 = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0;">
  <div style="text-align: center; padding-bottom: 20px;">
    <h2 style="color: #4CAF50;">Order received at our warehouse 📦</h2>
    <p style="color: #555;">Your order just landed at our warehouse and is getting prepped for shipment.</p>
  </div>

  <div style="background-color: #ffffff; padding: 20px; border-radius: 8px;">
    <h3 style="color: #333;">📍 Warehouse Arrival Details</h3>
    <p><strong>Order ID:</strong> <span style="color: #4CAF50;">#123456</span></p>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    <p><strong>Status:</strong> In Warehouse</p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />

    <p style="color: #555;">We'll ship your order shortly. You’ll get an update once it’s on the way.</p>
  </div>

  <div style="text-align: center; margin-top: 30px;">
    <a href="http://localhost:3000/orders" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Track My Order</a>
  </div>

  <div style="margin-top: 30px; font-size: 14px; color: #777; text-align: center;">
    <p>Need help? Just reply to this email.</p>
    <p>&copy; ${new Date().getFullYear()} Moda. All rights reserved.</p>
  </div>
</div>
`;

const html3 = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0;">
  <div style="text-align: center; padding-bottom: 20px;">
    <h2 style="color: #4CAF50;">Your order is on the way! 🚚</h2>
    <p style="color: #555;">We've shipped your order and it's headed your way.</p>
  </div>

  <div style="background-color: #ffffff; padding: 20px; border-radius: 8px;">
    <h3 style="color: #333;">🚚 Shipping Details</h3>
    <p><strong>Order ID:</strong> <span style="color: #4CAF50;">#123456</span></p>
    <p><strong>Shipped on:</strong> ${new Date().toLocaleDateString()}</p>
    <p><strong>Status:</strong> Shipped</p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />

    <p style="color: #555;">You can track the package from your dashboard. Expected delivery soon!</p>
  </div>

  <div style="text-align: center; margin-top: 30px;">
    <a href="http://localhost:3000/orders" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Track Shipment</a>
  </div>

  <div style="margin-top: 30px; font-size: 14px; color: #777; text-align: center;">
    <p>Questions? Just reply to this email—we’ve got your back.</p>
    <p>&copy; ${new Date().getFullYear()} Moda. All rights reserved.</p>
  </div>
</div>
`;

const html4 = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0;">
  <div style="text-align: center; padding-bottom: 20px;">
    <h2 style="color: #4CAF50;">Your order has been delivered! 📦</h2>
    <p style="color: #555;">We hope you're loving it already. Thank you for shopping with us!</p>
  </div>

  <div style="background-color: #ffffff; padding: 20px; border-radius: 8px;">
    <h3 style="color: #333;">🧾 Delivery Details</h3>
    <p><strong>Order ID:</strong> <span style="color: #4CAF50;">#123456</span></p>
    <p><strong>Delivered on:</strong> ${new Date().toLocaleDateString()}</p>
    <p><strong>Status:</strong> Delivered ✅</p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />

    <p style="color: #555;">We’d love to hear your feedback! You can review your order anytime in your profile dashboard.</p>
  </div>

  <div style="text-align: center; margin-top: 30px;">
    <a href="http://localhost:3000/orders" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View My Order</a>
  </div>

  <div style="margin-top: 30px; font-size: 14px; color: #777; text-align: center;">
    <p>If you have any questions, just reply to this email—we’re happy to help.</p>
    <p>&copy; ${new Date().getFullYear()} Moda. All rights reserved.</p>
  </div>
</div>
`;


module.exports = {html1, html2, html3, html4};