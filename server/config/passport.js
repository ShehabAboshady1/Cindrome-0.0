// config/passport.js
import passport from "passport";
import LocalStrategy from "passport-local";
import bcrypt from "bcrypt";
import db from "./db.js";

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, cb) => {
      try {
        const result = await db.query(
          "SELECT * FROM users WHERE email = $1 OR username = $1",
          [email],
        );
        if (result.rows.length === 0)
          return cb(null, false, { message: "User not found" });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (isMatch) return cb(null, user);
        else return cb(null, false, { message: "Incorrect password" });
      } catch (err) {
        return cb(err);
      }
    },
  ),
);

passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
  try {
    const result = await db.query(
      `SELECT u.*, p.avatar_url, p.display_name FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id WHERE u.id = $1`,
      [id],
    );
    if (result.rows.length > 0) cb(null, result.rows[0]);
    else cb(null, false);
  } catch (err) {
    cb(err);
  }
});

export default passport;
