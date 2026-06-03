const express = require("express");
const app = express();
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const MSSQLStore = require("connect-mssql-v2");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http").Server(app);
const io = require("socket.io")(http);
global.io = io;

const config = require("./config");
const port = config.port;

// Route Imports
const authentication = require("./routes/authentication");
const cart = require("./routes/cart");
const shop = require("./routes/shop");
const wish = require("./routes/wish");
const checkout = require("./routes/checkout");
const email = require("./routes/email");
const search = require("./routes/search");
const userInbox = require("./routes/user-inbox");
const userProfile = require("./routes/user-profile");
const info = require("./routes/info");
const error = require("./routes/error");

const { poolConnect } = require("./database/data");
const { getCurrentNotifications } = require("./helper-functions/time-based-update");

// wrap everything inside async IIFE
(async () => {
  try {
    await poolConnect;
    console.log("MSSQL connected");
    await require("./database/migrate")();

    // SESSION CONFIG (after DB ready)
    const sessionConfig = {
      name: "sessions",
      store: new MSSQLStore({
        user: config.db.user,
        password: config.db.password,
        server: config.db.server,
        port: config.db.port,
        database: config.db.database,
        options: {
          encrypt: true,
          trustServerCertificate: true,
        },
      }),
      secret: (() => {
        if (!config.sessionSecret) {
          throw new Error("[Main] SESSION_SECRET configuration is missing");
        }
        return config.sessionSecret;
      })(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    };

    // TRUST PROXY
    app.set("trust proxy", 1);

    // 1. SECURITY HEADERS (Helmet)
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.jsdelivr.net",
            "https://stackpath.bootstrapcdn.com",
            "https://kit.fontawesome.com",
            "https://ka-f.fontawesome.com",
            "https://cdnjs.cloudflare.com",
            "https://code.jquery.com"
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.jsdelivr.net",
            "https://stackpath.bootstrapcdn.com",
            "https://fonts.googleapis.com",
            "https://ka-f.fontawesome.com",
            "https://cdnjs.cloudflare.com"
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "https://stackpath.bootstrapcdn.com",
            "https://fonts.googleapis.com",
            "https://ka-f.fontawesome.com",
            "https://cdnjs.cloudflare.com"
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https://res.cloudinary.com",
            "https://images.unsplash.com",
            "https://mdbcdn.b-cdn.net",
            "https://bootdey.com",
            "http://bootdey.com",
            "https://*.bootdey.com",
            "http://*.bootdey.com"
          ],
          connectSrc: [
            "'self'",
            "ws:",
            "wss:",
            "https://cdn.jsdelivr.net",
            "https://ka-f.fontawesome.com",
            "https://stackpath.bootstrapcdn.com"
          ],
        }
      }
    }));

    // 2. RATE LIMITER (DoS Protection)
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: "Too many requests from this IP. Please try again in 15 minutes."
    });
    app.use(generalLimiter);

    // AUTH RATE LIMITER (Brute-Force Protection)
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 15,
      standardHeaders: true,
      legacyHeaders: false,
      message: "Too many login/signup attempts. Please try again in 15 minutes."
    });
    app.use("/login", authLimiter);
    app.use("/signup", authLimiter);
    app.use("/forgot-password", authLimiter);
    app.use("/reset-password", authLimiter);

    // 3. PARSERS & COOKIES & SESSION
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(methodOverride("_method"));
    app.use(cookieParser());
    app.use(session(sessionConfig));

    // Custom lightweight session-based req.flash helper
    app.use((req, res, next) => {
      req.flash = (type, msg) => {
        if (!req.session) return "";
        const sessionKey = `flash_${type}`;
        if (msg) {
          req.session[sessionKey] = msg;
          return msg;
        } else {
          const temp = req.session[sessionKey];
          delete req.session[sessionKey];
          return temp || "";
        }
      };
      next();
    });

    // 4. CSRF PROTECTION
    const { csrfTokenMiddleware } = require("./middleware/csrf");
    app.use(csrfTokenMiddleware);
    app.use((req, res, next) => {
      res.locals.success = req.flash("success");
      res.locals.error = req.flash("error");
      next();
    });

    // VIEWS
    app.set("view engine", "ejs");
    app.use(express.static(__dirname + "/public"));
    app.use("/users_images", express.static(path.join(__dirname, "users_images")));

    // SOCKET.IO
    io.on("connection", (socket) => {
      socket.on("join", (userId) => {
        socket.join(`user_${userId}`);
        getCurrentNotifications(userId);
      });
    });

    // 5. ROUTES
    app.use("/", authentication);
    app.use("/", cart);
    app.use("/", shop);
    app.use("/", wish);
    app.use("/", checkout);
    app.use("/", email);
    app.use("/", search);
    app.use("/", userInbox);
    app.use("/", userProfile);
    app.use("/", info);
    app.use("/", error);

    // 6. GLOBAL ERROR HANDLER
    app.use((err, req, res, next) => {
      console.error("[Main] Unhandled server error:", err);
      res.status(500).render("500-page");
    });

    // START SERVER
    http.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

  } catch (err) {
    console.error("[Main] Failed to start server:", err);
  }
})();
