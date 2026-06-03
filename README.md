# Moda E-commerce Web Application

**Moda** is a premium, full-stack e-commerce web storefront built with **Node.js**, **Express**, **EJS**, **Socket.IO**, and **Microsoft SQL Server**. The application is designed with high-end editorial streetwear aesthetics, offering a server-rendered shopping experience with robust authentication, product browsing, dynamic filtering, cart and wishlist management, secure checkout, real-time notification overlays, and transaction email tracking.

---

## Project Upgrades & Modernizations

This codebase has been optimized with production-grade reliability, visual performance, and security enhancements:

### 1. Centralized Configuration System
- All configuration keys and environment variables are consolidated inside `config.js` in the root.
- Replaced scattered raw `process.env` references to prevent silent lookup crashes and ensure clean environment separation.

### 2. Transactional Email System (Resend API)
- Upgraded the email delivery from GMAIL SMTP (Nodemailer) to the official **Resend API SDK**.
- **Local Git-Controlled Templates:** Created a dedicated `email-templates/` directory containing responsive, neo-brutalist HTML templates styled with design tokens from `global.css`.
- Emails are loaded and compiled at runtime from the local disk using string placeholder replacements (e.g. `{{{firstname}}}`), keeping templates version-controlled in Git.
- Official backend email domains send from `@modashop.store` (like `noreply@modashop.store`, `support@modashop.store`, `orders@modashop.store`).

### 3. Responsive Search Sidebar & Filters
- Modified search filter sidebar styling (`public/css/search.css`): Enabled sticky scrolling for desktop grid viewports (`min-width: 901px`), but collapsed it into normal, non-sticky document flow on smaller mobile devices.

### 4. Visual Performance & Image Optimization
- Implemented `loading="lazy"`, custom `smooth-image` fade-in CSS transitions, and explicit height/width attributes for all product cards, logos, and avatars across all EJS views to eliminate Cumulative Layout Shift (CLS).
- Added base64 inline SVG image placeholders on error (`onerror`) to prevent broken visual cards if external image hosts fail.

### 5. Review Database Seeding & User Isolation
- Integrated database migrations in `database/migrate.js` to alter tables on startup (introducing `is_seed` column on `users` table).
- Implemented an automated database seeder that creates 8 realistic seed user accounts flagged with `is_seed = 1` and registers 498 unique product reviews linked directly to those IDs.
- Seeded reviewer accounts are isolated from real user logs or analytics metrics.

### 6. Checkout Redirection
- Removed separate GET `/edit-profile` route and `views/auth/edit.ejs` view file.
- Consolidated user details modifications directly into the in-page profile editing dashboard inside `/user-profile`.
- Redirected the checkout profile and address modifier links directly to `/user-profile`.

### 7. Security Pipeline and Order
- Structured `main.js` middleware stack strictly in the correct loading order: Helmet (Security headers) → Rate Limiter (general + auth thresholds) → Parsers (JSON/URL/cookies) → SQL Session Store → CSRF protection → Route handlers → Global 500 error boundary.

---

## Technology Stack

### Backend
- **Node.js + Express**: App logic and server-side routing
- **EJS**: Server-rendered templating views
- **Microsoft SQL Server + `mssql`**: Primary database store
- **`connect-mssql-v2`**: SQL Server backed session storage
- **Resend Node.js SDK**: High-deliverability transactional email gateway
- **Socket.IO**: Real-time customer notifications
- **Multer + Cloudinary**: File uploads and secure image hosting
- **Helmet + Express Rate Limit**: Enterprise security headers and DOS throttling

### Frontend
- **Bootstrap 5 / Tailwind CSS**: Unified utility UI styling
- **Custom CSS Modules**: Neo-brutalist editorial typography and color themes
- **Client JS**: AJAX dynamic shopping cart, product details coordination, coordinate hover zoom, and review handlers

---

## Project Structure

```text
.
|-- cloudinary/             # Cloudinary storage configuration
|-- database/               # SQL Server pool setup and schema migration logic
|-- email-templates/        # Local HTML email templates (verification, reset, order, contact)
|-- helper-functions/       # Resend email, search indexing, rating, and validation modules
|-- middleware/             # Auth guards, CSRF, cookie parsing, and session loading
|-- partials/               # Shared headers, footers, navbars, and component partials
|-- public/                 # Static global CSS stylesheets, images, and documents
|-- routes/                 # Express page routers (signup, cart, checkout, shop, search, etc.)
|-- seeds/                  # JSON product catalogs, notifications, ratings, and reviews
|-- views/                  # Core application EJS pages
|-- main.js                 # Unified server entry point
|-- config.js               # Centralized configuration management
|-- package.json            # Scripts, dependency locks, and metadata
`-- tailwind.config.js      # Custom theme grid details
```

---

## Environment Variables

Create a `.env` file in the project root with the following configuration:

```env
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# Database Configuration
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_SERVER=your_database_server_address
DB_PORT=1433
DB_NAME=your_database_name

# Session Configuration
SESSION_SECRET=your_secure_random_session_secret

# Resend Mail Configuration
RESEND_API_KEY=your_resend_api_key

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

---

## Installation & Running

1. **Install Dependencies**
```bash
npm install
```

2. **Run in Development Mode**
```bash
npm run dev
```

3. **Run in Production Mode**
```bash
npm start
```

---

## License

This project is licensed under the MIT License. See the `license` file for details.
