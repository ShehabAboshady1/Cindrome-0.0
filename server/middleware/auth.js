// middleware/auth.js

export function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  // لو ده طلب API (زي لايك أو كومنت)، بنرد بـ JSON
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  // لو بيحاول يفتح صفحة (زي diary أو settings)، بنحوله لصفحة تسجيل الدخول
  res.redirect("/sign-in");
}

export function ensureNotAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}
