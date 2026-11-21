import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { COOKIE_NAME } from "../utils/auth.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Please sign in to continue." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("_id name email");

    if (!user) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Your session is no longer valid. Please sign in again.",
        });
    }

    req.user = user;
    next();
  } catch {
    return res
      .status(401)
      .json({
        success: false,
        message:
          "Your session is invalid or has expired. Please sign in again.",
      });
  }
}
