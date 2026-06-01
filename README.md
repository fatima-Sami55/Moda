🛍️ Moda — E-commerce Web Application
======================================

A modern, full-featured, and responsive e-commerce web application built with Node.js, Express, EJS, and Microsoft SQL Server (hosted on Azure).

🎯 Project Overview
-------------------

**Moda** is an end-to-end e-commerce platform designed for modern retail experiences. It includes user authentication, cart & wishlist features, real-time notifications, email verification, order management, admin dashboards, and mobile-first responsive UI — all backed by a robust MSSQL database deployed on Microsoft Azure.

⚙️ Core Functionality
---------------------

*   👤 User registration, login, and email verification
*   🛒 Cart and wishlist functionality with session handling
*   📦 Order placement, tracking, and review submission
*   🔔 Real-time notifications (Socket.IO) for order status
*   📧 Email sending using Nodemailer (e.g., activation links, order confirmations)
*   🖼️ Product image uploads via Multer
*   🕐 Cron jobs for background tasks like notifications
*   📱  Mobile-responsive design with custom breakpoints
*   👉 And much more

💻 Tech Stack
-------------

##### 🧠 Backend

*   **Node.js & Express** — Core server logic and routing
*   **MSSQL (via `mssql`)** — Main database, hosted on Azure
*   **connect-mssql-v2** — Session store using SQL Server
*   **Passport.js** — Local strategy for user authentication
*   **Socket.IO** — Real-time communication for notifications
*   **Node-cron** — Task scheduling for background jobs

##### 🎨 Frontend

*   **EJS** — Templating engine for server-rendered HTML
*   **Bootstrap 5** — Responsive layout and UI components
*   **TailwindCSS** — Utility-first styling for custom design
*   **JavaScript** — Form validation, AJAX, and dynamic UI behavior

🌐 Responsiveness
-----------------

The entire application is built with a mobile-first approach using Bootstrap grid system and Tailwind utility classes. The layout adapts seamlessly across:

*   📱 Mobile (hamburger menus, stacked layouts)
*   💻 Desktop (sidebars, dropdowns, modals)
*   🖥️ Large screens (multi-column product galleries)

☁️ Deployment & Hosting
-----------------------

The MSSQL database is hosted on **Microsoft Azure** for scalability and cloud reliability. The app is production-ready for deployment on platforms like Render, Railway, or custom VPS environments.

🚀 Installation & Setup
-----------------------

1.  Clone the repository
2.  Install dependencies:
    
        npm install
    
3.  Create a `.env` file with the following variables:

*    PORT=3000
*    DB_USER=your_db_username
*    DB_PASSWORD=your_password
*    DB_NAME=your_database_name
*    SESSION_SECRET=your_secure_secret
*    EMAIL_USER=<youremail@example.com>
*    EMAIL_PASS=emailpassword
*    BASE_URL=<http://localhost:{port}>


4.  Run the development server:
    
        npm run dev
    
📄 License
----------

This project is licensed under the **MIT License**. You are free to use, modify, and distribute it with proper attribution.

* * *

© 2025 Moda WebApp — All Rights Reserved
