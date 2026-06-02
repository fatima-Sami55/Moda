# Moda E-commerce Web Application

Moda is a full-stack e-commerce web application built with Node.js, Express, EJS, Socket.IO, and Microsoft SQL Server. The project provides a server-rendered shopping experience with authentication, product browsing, cart and wishlist management, checkout, order tracking, reviews, notifications, and transactional email support.

## Project Overview

Moda is designed as a complete retail storefront for fashion and accessories. It combines server-side rendering with interactive client-side behavior to support a responsive shopping workflow across desktop and mobile devices.

The application includes customer account management, email verification, profile management, product discovery, category filtering, real-time notifications, and order lifecycle tracking. Static product seed data is used alongside database-backed user, cart, wishlist, review, order, notification, and email records.

## Key Features

- User registration, login, logout, and session management
- Email verification and password reset flows
- Product catalog for home, shop, men, women, kids, and accessories
- Product detail pages with ratings, reviews, and related product suggestions
- Cart and wishlist management
- Secure checkout workflow with CSRF protection
- Order history and order tracking views
- Review submission and review deletion
- User profile editing with image upload support
- Real-time user notifications with Socket.IO
- Contact form and transactional email delivery with Nodemailer
- SQL Server backed sessions using `connect-mssql-v2`
- Production-focused security middleware with Helmet, rate limiting, secure cookies, and CSRF validation
- Responsive EJS views with custom CSS, Bootstrap, and Tailwind configuration

## Technology Stack

### Backend

- Node.js
- Express
- EJS
- Microsoft SQL Server
- `mssql`
- `connect-mssql-v2`
- Express Session
- Socket.IO
- Nodemailer
- Multer and Cloudinary storage
- Node Cron
- Helmet
- Express Rate Limit
- Validator

### Frontend

- EJS templates
- Bootstrap
- Tailwind CSS configuration
- Custom CSS modules by page
- Client-side JavaScript for AJAX workflows, filtering, sorting, cart actions, wishlist actions, reviews, and notifications

### Data and Assets

- SQL Server for application data and sessions
- JSON seed files for product catalog data
- Kebab-case static asset naming under `public/image`
- Static documents under `public/documents`

## Project Structure

```text
.
|-- cloudinary/             # Cloudinary storage configuration
|-- database/               # SQL Server connection and schema migration logic
|-- helper-functions/       # Email, search, rating, notification, and validation helpers
|-- middleware/             # Authentication, CSRF, user, cart, wishlist, order, and verification middleware
|-- partials/               # Shared EJS partials
|-- public/                 # Static CSS, images, and documents
|-- routes/                 # Express route modules
|-- seeds/                  # Product, accessory, notification, and rating seed data
|-- views/                  # Page-level EJS templates
|-- main.js                 # Application entry point
|-- package.json            # Project scripts and dependencies
`-- tailwind.config.js      # Tailwind configuration
```

## Environment Variables

Create a `.env` file in the project root with the required runtime configuration.

```env
PORT=3000
NODE_ENV=development

DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_SERVER=your_database_server
DB_PORT=1433
DB_NAME=your_database_name

SESSION_SECRET=your_secure_session_secret
BASE_URL=http://localhost:3000

GMAIL_USER=your_email_address
GMAIL_PASS=your_email_password_or_app_password

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_KEY=your_cloudinary_api_key
CLOUDINARY_SECRET=your_cloudinary_api_secret
```

## Installation

Install dependencies from the project root.

```bash
npm install
```

## Running the Application

Start the development server with Nodemon.

```bash
npm run dev
```

Start the application in production mode.

```bash
npm start
```

The application listens on the port defined by `PORT`.

## Database Setup

The application expects a SQL Server database configured through the `.env` variables. On startup, `database/migrate.js` runs schema checks for required tracking and password reset columns.

Before running in production, confirm that:

- Database credentials are valid.
- The SQL Server firewall allows connections from the deployment environment.
- `SESSION_SECRET` is set to a strong private value.
- Email and Cloudinary credentials are configured.
- `BASE_URL` matches the deployed application URL.

## Security Notes

The application includes several production-oriented safeguards:

- Helmet security headers
- General request rate limiting
- Stricter rate limiting for authentication routes
- HTTP-only session cookies
- Secure cookies when `NODE_ENV=production`
- CSRF token middleware
- Session storage in SQL Server
- Sanitized production logging without sensitive request bodies, CSRF token values, or email payloads

## Static Asset Naming

Static images in `public/image` use kebab-case naming. This keeps paths consistent across Windows, Linux, and cloud deployment environments where case sensitivity can differ.

Examples:

- `public/image/home/card-1.avif`
- `public/image/logos/master-card.svg`
- `public/image/vectors/empty-cart.svg`
- `public/image/charts/size-chart-men.jpg`

## Available Scripts

```bash
npm run dev
npm start
```

## Production Checklist

Before deploying, verify the following:

- `NODE_ENV` is set to `production`.
- `SESSION_SECRET` is configured and private.
- SQL Server credentials are available in the environment.
- Cloudinary credentials are available if profile image uploads are enabled.
- Email credentials are available for verification, password reset, contact, and order emails.
- All static asset paths use kebab-case and resolve correctly.
- The deployment platform provides HTTPS so secure cookies can be used.

## License

This project is licensed under the MIT License. See the `license` file for details.
