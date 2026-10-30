import bcrypt from "bcrypt";
import db from "../config/db.js";

export const renderSignIn = (req, res) => res.render("sign-in.ejs");
export const renderSignUp = (req, res) => res.render("sign-up.ejs");

// Register a new user account and initialize profile/settings records
export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const checkUser = await db.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2",
      [email, username],
    );

    if (checkUser.rows.length > 0) {
      const existingUser = checkUser.rows[0];
      let errorMsg = "Account already exists";
      if (existingUser.email === email)
        errorMsg = "This Email is already registered!";
      else if (existingUser.username === username)
        errorMsg = "This Username is already taken!";

      return res.render("sign-up.ejs", { errorMessage: errorMsg });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertResult = await db.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [username, email, hashedPassword],
    );
    const newUserId = insertResult.rows[0].id;

    await db.query(
      "INSERT INTO user_settings (user_id, is_private) VALUES ($1, $2)",
      [newUserId, false],
    );
    await db.query(
      "INSERT INTO user_profiles (user_id, avatar_url, backdrop_url) VALUES ($1, $2, $3)",
      [
        newUserId,
        "/assets/avatars/default-avatar.jpeg",
        "/assets/backdrops/default-backdrop.png",
      ],
    );

    const newUser = { id: newUserId, username, email };
    req.login(newUser, (err) => {
      if (err)
        return res.render("sign-up.ejs", {
          errorMessage: "Registration successful, but login failed.",
        });
      return res.redirect("/");
    });
  } catch (error) {
    console.error(error);
    return res.render("sign-up.ejs", {
      errorMessage: "Internal Server Error. Please try again.",
    });
  }
};

// Terminate user session and redirect
export const logoutUser = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
};

// Update user profile information, uploaded assets, and favorite genres
export const editProfile = async (req, res) => {
  const userId = req.user.id;
  const { displayName, username, bio, genre1, genre2 } = req.body;
  const files = req.files;

  try {
    await db.query("UPDATE users SET username = $1 WHERE id = $2", [
      username,
      userId,
    ]);
    await db.query(
      "UPDATE user_profiles SET display_name = $1, bio = $2 WHERE user_id = $3",
      [displayName, bio, userId],
    );

    let newAvatarUrl = req.user.avatar_url;

    if (files?.avatar) {
      const avatarPath = `/assets/avatars/${files.avatar[0].filename}`;
      await db.query(
        "UPDATE user_profiles SET avatar_url = $1 WHERE user_id = $2",
        [avatarPath, userId],
      );
      newAvatarUrl = avatarPath;
    }

    if (files?.backdrop) {
      const backdropPath = `/assets/backdrops/${files.backdrop[0].filename}`;
      await db.query(
        "UPDATE user_profiles SET backdrop_url = $1 WHERE user_id = $2",
        [backdropPath, userId],
      );
    }

    await db.query("DELETE FROM user_favorite_genres WHERE user_id = $1", [
      userId,
    ]);
    if (genre1)
      await db.query(
        "INSERT INTO user_favorite_genres (user_id, genre) VALUES ($1, $2)",
        [userId, genre1],
      );
    if (genre2 && genre2 !== genre1)
      await db.query(
        "INSERT INTO user_favorite_genres (user_id, genre) VALUES ($1, $2)",
        [userId, genre2],
      );

    const updatedUser = { ...req.user, username, avatar_url: newAvatarUrl };

    req.login(updatedUser, function (err) {
      if (err)
        return res
          .status(500)
          .json({ error: "Profile updated, but session refresh failed." });
      return res.status(200).json({
        message: "Profile updated successfully",
        newUsername: username,
      });
    });
  } catch (error) {
    if (error.code === "23505")
      return res.status(400).json({ error: "Username is already taken." });
    res.status(500).json({ error: "Internal Server Error." });
  }
};
