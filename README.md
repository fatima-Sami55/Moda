# Moda E-Commerce Storefront

A high-performance, full-stack fashion web application built with **Node.js**, **Express**, **EJS**, **Microsoft SQL Server**, **Socket.IO**, and **Resend** email service, featuring high-end neo-brutalist typography and editorial streetwear aesthetics.

* **Live URL:** [https://modashop.store](https://modashop.store)

---

## Table of Contents
1. [Key Features](#key-features)
2. [Technology Stack](#technology-stack)
3. [Project Directory Structure](#project-directory-structure)
4. [Environment Configuration](#environment-configuration)
5. [Email System (Resend Integration)](#email-system-resend-integration)
6. [Database System (MSSQL on Azure)](#database-system-mssql-on-azure)
7. [Deployment Guide](#deployment-guide)
8. [Custom Domain Setup](#custom-domain-setup)
9. [Security Architecture](#security-architecture)
10. [Known Limitations & Future Roadmap](#known-limitations--future-roadmap)
11. [License](#license)

---

## Key Features

* **User Authentication & Session Management**: Secure user accounts with hashed passwords (bcrypt), express-session state storage, and dynamic role determination.
* **Email Verification Flow**: Signups require a verified email address via transactional verification tokens.
* **Dynamic Search & Filtering**: Complex search page equipped with responsive categories, tag filters, sorting (price, reviews, rating), and desktop-sticky filter columns.
* **Interactive Shopping Cart & Wishlist**: Pure AJAX-based product interactions avoiding page refreshes, and syncs instantly with database records.
* **Interactive Reviews & Rating System**: Post, edit, or delete star ratings and text reviews for purchased items, automatically recalculating product averages.
* **Real-Time Web Notification Portal**: Dynamic Socket.IO alert overlay for order updates, transactional confirmations, and custom notifications.
* **Multi-Step Checkout**: Client-side form validations and automated calculations for tax and shipping rates.
* **CLS-Optimized Visual Loading**: Progressive image loading via custom fade-in transitions, lazy loading (`loading="lazy"`), and base64 SVG shims to resolve Cumulative Layout Shift (CLS).
* **Responsive Layouts**: Premium neo-brutalist theme components optimized for desktop, tablet, and mobile device viewport widths.

---

## Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend Framework** | Node.js / Express | Server-side routing, controllers, and APIs |
| **Database** | Microsoft SQL Server (MSSQL) | Primary data layer hosted on Azure SQL |
| **View Engine** | EJS (Embedded JavaScript) | Server-rendered pages with custom partial components |
| **Session Manager** | Connect MSSQL v2 | Server-side sessions persisted inside MSSQL database |
| **WebSockets** | Socket.IO | Real-time live notifications and update broadcasts |
| **Emails** | Resend Node.js SDK | Dedicated transactional email gateway |
| **Media Delivery** | Multer + Cloudinary SDK | File uploads and optimized image CDN delivery |
| **Styling** | Bootstrap 5 + Tailwind CSS | Hybrid utility layout framework and design tokens |

---

## Project Directory Structure

```text
.
├── cloudinary/             # Cloudinary storage engine and API configuration
├── database/               # SQL database pool configuration and migrate/seed routines
├── email-templates/        # Local HTML email templates (verification, reset, orders)
├── helper-functions/       # Shared utility helpers (emails, rating engines, logging, validators)
├── middleware/             # Route guards (auth checking, CSRF validation, helmet security headers)
├── partials/               # Reusable UI EJS components (headers, navbars, footers, scripts)
├── public/                 # Static styling files (custom CSS, fonts, assets, client scripts)
│   ├── css/                # Page CSS overrides (global, search, product details, auth)
│   └── js/                 # Client side AJAX handlers and layout interactivity
├── routes/                 # Express route controllers divided by feature areas
├── seeds/                  # Seed database contents (mock catalog files and reviews JSON)
├── views/                  # Primary EJS page layout views
│   └── auth/               # Access forms (login, signup, forgot password, reset)
├── config.js               # Centralized configurations and environment variable parser
├── main.js                 # Unified application entry point
├── package.json            # Scripts, dependency locks, and metadata
└── tailwind.config.js      # Layout grid presets for custom styles
```

---

## Environment Configuration

Create a `.env` file in your project's root folder using the parameters below:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `PORT` | Local server port | `3000` |
| `NODE_ENV` | Mode of operation | `production` / `development` |
| `BASE_URL` | Base host domain | `https://modashop.store` |
| `DB_USER` | SQL Database username | `moda_admin` |
| `DB_PASSWORD` | SQL Database password | `SecureSQLPass123!` |
| `DB_SERVER` | Server URI / Azure Address | `moda-server.database.windows.net` |
| `DB_PORT` | MSSQL connection port | `1433` |
| `DB_NAME` | MSSQL database schema name | `modadb` |
| `SESSION_SECRET` | Secret key used to encrypt cookies | `8e3a2b7f8c92a7281f9b33a01` |
| `RESEND_API_KEY` | Resend API Authorization Token | `re_123456789g` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary unique name ID | `modacloud` |
| `CLOUDINARY_API_KEY` | Cloudinary public api key | `928138291029` |
| `CLOUDINARY_API_SECRET` | Cloudinary private secret key | `xX_SecretApiToken_Xx` |

---

## Email System (Resend Integration)

The application uses the high-deliverability **Resend API SDK** to dispatch transactional emails. To keep email setups version-controlled under Git, the system bypasses Resend's online template editor portal entirely, instead loading local HTML templates from the `email-templates/` directory and substituting placeholders dynamically.

### Template Types & Variables
1. **Verification Email (`verification.html`)**
   * Purpose: Welcome new users and request activation.
   * Placeholders: `{{{firstname}}}`, `{{{verifyUrl}}}`
2. **Password Reset Email (`password-reset.html`)**
   * Purpose: Provide link to recover accounts.
   * Placeholders: `{{{firstname}}}`, `{{{resetUrl}}}`
3. **Password Updated Email (`password-updated.html`)**
   * Purpose: Send security confirmation when account password changes.
   * Placeholders: `{{{firstname}}}`
4. **Order Status Confirmation (`order-status.html`)**
   * Purpose: Updates customers on changes in order status.
   * Placeholders: `{{{title}}}`, `{{{headerTitle}}}`, `{{{message}}}`, `{{{ctaText}}}`, `{{{ctaUrl}}}`
5. **Contact Support Email (`contact-support.html`)**
   * Purpose: Sends a structured ticket outline to customer support.
   * Placeholders: `{{{senderName}}}`, `{{{senderEmail}}}`, `{{{subject}}}`, `{{{message}}}`

### Sender Identities
All system communications use dedicated, domain-authenticated mail headers to prevent spam flag filters:
* **Transactional updates (verifications, passwords):** `Moda <noreply@modashop.store>`
* **Order status alerts (receipts, delivery):** `Moda Orders <orders@modashop.store>`
* **Customer service / contact requests:** `Moda Support <support@modashop.store>`

---

## Database System (MSSQL on Azure)

The application uses **Azure SQL Database** as its primary storage engine. 

### Migration & Seeding System
* When the application starts, it connects to Azure SQL and executes `database/migrate.js` to automatically verify schema columns.
* It checks for `reset_token`, `reset_expires`, and `is_seed` columns on the `users` table, and automatically patches them into your schema structure.
* **Is_Seed User Flag**: All seed reviewer accounts are flagged with `is_seed = 1`. This isolates seed profiles and their testing activity from your live analytics metrics, administrative lists, or real customer operations.

---

## Deployment Guide

Follow these steps to deploy the application on **Render**:

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/moda-ecommerce.git
cd moda-ecommerce
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Local Test Configuration
1. Create a `.env` file in the root folder.
2. Fill out the environment variables according to the table in [Environment Configuration](#environment-configuration).
3. Start the local server:
   ```bash
   npm run dev
   ```

### Step 4: Deploy on Render
1. Register/Login on [Render](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Set the following settings:
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
5. Go to the **Environment** tab and add all the environment variables from your `.env` file (excluding `PORT` as Render assigns it automatically).
6. Click **Deploy Web Service**.

---

## Custom Domain Setup

To configure a custom domain like `modashop.store` using **Namecheap** or other domain registrars:

### 1. DNS Configuration (Namecheap Dashboard)
Log in to your Namecheap account, navigate to **Advanced DNS**, and add the following records:

| Type | Host | Value | TTL |
| :--- | :--- | :--- | :--- |
| **A Record** / **ALIAS** | `@` | Render Web Service IP Address (e.g., `216.24.57.1`) | Automatic |
| **CNAME Record** | `www` | Your Render domain (e.g., `moda-app.onrender.com`) | Automatic |

### 2. Render Panel Configuration
1. Open your Render Web Service dashboard.
2. Navigate to **Settings** and scroll down to the **Custom Domains** section.
3. Click **Add Custom Domain** and enter `modashop.store` (and optionally `www.modashop.store`).
4. Click **Save**. Render will automatically verify the DNS records and issue a free Let's Encrypt SSL certificate.

---

## Security Architecture

The application implements a production-grade defense stack to protect client data:

* **Helmet Middleware**: Enforces secure HTTP headers including strict Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), Frame Options, and X-Content-Type-Options.
* **CSRF Token Validation**: Employs double-submit cookie validations for state-changing endpoints (POST/PUT/DELETE) to shield user routes from Cross-Site Request Forgery.
* **Express Rate Limiters**: Protects routes from brute-force authentication attempts (signups, logins, and password resets capped at 15 requests per 15 minutes) and standard requests (capped at 200 per 15 minutes).
* **Secure Cookie Directives**: Cookies are configured with `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) to prevent cookie sniffing and hijacking.
* **Azure SQL Firewall Rules**: Only whitelisted IP addresses (such as Render's server IPs) are permitted to open connections to the MSSQL database.
* **Data Input Sanitization**: Form fields use parameterized SQL queries inside the `mssql` pool, eliminating SQL injection vectors.

---

## Known Limitations & Future Roadmap

* **Startup Schema Check**: Schema checks run synchronously during server start; in large enterprise scenarios, schema migrations should be managed via dedicated migrations tools (like Knex or Sequelize CLI).
* **Payment Gateway**: Current checkout processes are mock transactions. Integration with Stripe or PayPal is planned.
* **Cache Layer**: Product query results are served directly from MSSQL. Implementing Redis cache queries for product listings would optimize retrieval times.

---

## License

This project is licensed under the MIT License. See the `license` file for details.
