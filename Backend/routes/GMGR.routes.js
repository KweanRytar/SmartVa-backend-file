import { Router } from "express";
import { GeneralMessage, GeneralReminder } from "../controller/GMGR.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

router.post('/send-general-message', authenticate, GeneralMessage);
router.post('/general-reminder', authenticate, GeneralReminder);

export default router;