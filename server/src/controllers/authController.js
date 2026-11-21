import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { clearAuthCookie, createToken, setAuthCookie } from "../utils/auth.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

export async function register(req, res, next) {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password ?? "");

    if (name.length < 2 || name.length > 60) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Name must be between 2 and 60 characters.",
        });
    }
    if (email.length > 254 || !emailPattern.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid email address." });
    }
    if (password.length < 8 || password.length > 72) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Password must be between 8 and 72 characters.",
        });
    }

    const existingUser = await User.findOne({ email }).select("_id");
    if (existingUser) {
      return res
        .status(409)
        .json({
          success: false,
          message: "An account with this email already exists.",
        });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    setAuthCookie(res, createToken(user._id.toString()));

    return res
      .status(201)
      .json({
        success: true,
        message: "Account created successfully.",
        user: publicUser(user),
      });
  } catch (error) {
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({
          success: false,
          message: "An account with this email already exists.",
        });
    }
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password ?? "");

    if (!emailPattern.test(email) || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Enter your email and password." });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    setAuthCookie(res, createToken(user._id.toString()));
    return res.json({
      success: true,
      message: "Signed in successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
}

export function logout(_req, res) {
  clearAuthCookie(res);
  return res.json({ success: true, message: "Signed out successfully." });
}

export async function getMe(req, res) {
  return res.json({ success: true, user: publicUser(req.user) });
}
