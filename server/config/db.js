import pg from "pg";
import dotenv from "dotenv";

// تشغيل الخزنة السرية (هتشتغل على اللابتوب، وفي Render ملهاش تأثير ضار)
dotenv.config();

const { Pool } = pg;

// دي الحركة الذكية: هنقوله لو لقيت الرابط بتاع Render استخدمه فوراً،
// لو ملقتهوش، استخدم المتغيرات الفردية بتاعت اللابتوب
const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

// هنحدد إننا نفعل الـ SSL فقط لو كان الرابط بيحتوي على كلمة render
// (عشان ميضربش إيرور عندك على اللابتوب)
const isRender = connectionString.includes("render.com");

const db = new Pool({
  connectionString: connectionString,
  ssl: isRender ? { rejectUnauthorized: false } : false,
});

db.connect()
  .then(() => console.log("✅ Connected to Cindrome Database successfully!"))
  .catch((err) => console.error("❌ Database connection error:", err.stack));

export default db;
 