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
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
