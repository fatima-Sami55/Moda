function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect("/home"); 
  }
  next();
}

module.exports = redirectIfAuthenticated;
