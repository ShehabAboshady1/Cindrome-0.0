import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
  res.render("index.ejs");
});
app.get("/anime", (req, res) => {
  res.render("anime.ejs");
});
app.get("/details", (req, res) => {
  res.render("details.ejs");
});
app.get("/diary", (req, res) => {
  res.render("diary.ejs");
});
app.get("/discover", (req, res) => {
  res.render("discover.ejs");
});
app.get("/drome", (req, res) => {
  res.render("drome.ejs");
});
app.get("/lists", (req, res) => {
  res.render("lists.ejs");
});
app.get("/movies", (req, res) => {
  res.render("movies.ejs");
});
app.get("/profile", (req, res) => {
  res.render("profile.ejs");
});
app.get("/series", (req, res) => {
  res.render("series.ejs");
});
app.get("/settings", (req, res) => {
  res.render("settings.ejs");
});
app.get("/sign-in", (req, res) => {
  res.render("sign-in.ejs");
});
app.get("/sign-up", (req, res) => {
  res.render("sign-up.ejs");
});
app.get("/single-list", (req, res) => {
  res.render("single-list.ejs");
});
app.get("/single-review", (req, res) => {
  res.render("single-review.ejs");
});
app.get("/watchlist", (req, res) => {
  res.render("watchlist.ejs");
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
