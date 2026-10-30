import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Use hosted database URL if available, fallback to local environment variables
const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

// Enable SSL strictly for hosted environments (e.g., render.com)
const isRender = connectionString.includes("render.com");

const db = new Pool({
  connectionString: connectionString,
  ssl: isRender ? { rejectUnauthorized: false } : false,
});

db.connect()
  .then(() => console.log("Connected to Cindrome Database successfully."))
  .catch((err) => console.error("Database connection error:", err.stack));

export default db;
