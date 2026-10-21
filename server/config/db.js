import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
const { Pool } = pg;

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect()
  .then(() => console.log("Connected to Cindrome Database successfully!"))
  .catch((err) => console.error("Database connection error:", err.stack));
export default db;
