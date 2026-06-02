async function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  if (req.session) {
    req.session.returnTo = req.originalUrl;
  }
  req.flash("error", "🚫 Please log in to access this page.");
  req.session.save(() => {
    res.redirect('/login');
  });
}

module.exports = isAuthenticated;
  