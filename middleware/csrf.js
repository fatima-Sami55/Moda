const crypto = require("crypto");

/**
 * Global CSRF middleware to generate and expose token to EJS views
 */
function csrfTokenMiddleware(req, res, next) {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
  } else {
    res.locals.csrfToken = null;
  }
  next();
}

/**
 * Route-specific middleware to verify CSRF token on sensitive endpoints
 */
function verifyCsrf(req, res, next) {
  // Safe methods do not require verification
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const token = req.body._csrf || req.query._csrf || req.headers["x-csrf-token"];
  
  if (!req.session || !req.session.csrfToken || token !== req.session.csrfToken) {
    console.warn("CSRF verification failed");
    req.flash("error", "❌ Security Session Timeout or Forgery Detected. Please try again.");
    
    // Support AJAX and standard form requests gracefully
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('json')) {
      return res.status(403).json({ error: "Security validation failed. Please refresh and try again." });
    }
    
    return res.status(403).send("Forbidden: Invalid CSRF Token");
  }
  next();
}

module.exports = { csrfTokenMiddleware, verifyCsrf };
