// Authentication guard middlewares

export function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  // Handle unauthorized API requests with JSON responses
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  // Redirect unauthorized page views to sign-in
  res.redirect("/sign-in");
}

export function ensureNotAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}
