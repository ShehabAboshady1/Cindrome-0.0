import pg from "pg";
import dotenv from "dotenv";

// تشغيل الخزنة السرية
dotenv.config();

const { Pool } = pg;

// إعدادات الاتصال الذكية
const db = new Pool({
  // لو فيه رابط أونلاين استخدمه، لو مفيش استخدم بيانات اللابتوب المحلي
  connectionString:
    process.env.DATABASE_URL ||
    `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,

  // سيرفرات Render بتشترط اتصال مشفر (SSL) لما نكلمها من بره
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// اختبار الاتصال
db.connect()
  .then(() => console.log("✅ Connected to Cindrome Database successfully!"))
  .catch((err) => console.error("❌ Database connection error:", err.stack));

export default db;
