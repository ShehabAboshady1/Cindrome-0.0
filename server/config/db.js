import pg from "pg";
import dotenv from "dotenv";

// تشغيل الخزنة السرية
dotenv.config();

const { Pool } = pg;

// تجهيز إعدادات الاتصال بناءً على البيئة (Local أو Production)
const isProduction = process.env.NODE_ENV === "production";

// إعدادات الاتصال
const connectionString = isProduction
  ? process.env.DATABASE_URL
  : `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const db = new Pool({
  connectionString: connectionString,
  // تفعيل الـ SSL فقط في حالة الـ Production (Render)
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// اختبار الاتصال
db.connect()
  .then(() => console.log("✅ Connected to Database successfully!"))
  .catch((err) => console.error("❌ Database connection error:", err.stack));

export default db;
