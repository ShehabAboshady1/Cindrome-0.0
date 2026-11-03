// routes/dromeRoutes.js
import express from "express";
import * as dromeController from "../controllers/dromeController.js";

// اختياري: إذا أردت أن يكون Drome للمسجلين فقط، يمكنك استيراد ensureAuthenticated واستخدامه
// import { ensureAuthenticated } from "../middleware/auth.js";

const router = express.Router();

// مسار استقبال طلبات المحادثة من Drome AI
router.post("/api/drome/chat", dromeController.processChat);

export default router;
