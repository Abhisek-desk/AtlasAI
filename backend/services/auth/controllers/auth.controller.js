import { getAuth } from "firebase-admin/auth";
import crypto from "node:crypto";

import app from "../config/firebase.js";
import User from "../models/user.model.js";
import redis from "../../../shared/redis/redis.js";

// What the gateway keeps in Redis for a logged-in user (returned by /api/me).
const buildSessionData = (user) => ({
  userId: user._id.toString(),
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  plan: user.plan,
  credits: user.credits,
  totalCredits: user.totalCredits,
  planExpiresAt: user.planExpiresAt,
});

// Only other services (billing, agent) may call the credit endpoints. The
// gateway exposes /api/auth to everyone, so without this anybody could give
// themselves credits or drain someone else's.
const isInternalRequest = (req) => {
  const secret = process.env.INTERNAL_API_SECRET;
  const received = String(req.headers["x-internal-secret"] || "");

  return Boolean(
    secret &&
      received.length === secret.length &&
      crypto.timingSafeEqual(Buffer.from(received), Buffer.from(secret)),
  );
};

// Writes the user's current plan/credits into their session so /api/me (and
// the sidebar) show them straight away, keeping the session's remaining life.
// `sessionIdHint` is the browser session that paid; otherwise the user's most
// recent session (remembered at login) is used.
const refreshSession = async (user, sessionIdHint) => {
  const sessionId =
    sessionIdHint || (await redis.get(`user-session:${user._id}`));

  if (!sessionId) return;

  const key = `session:${sessionId}`;
  const ttl = await redis.ttl(key);

  if (ttl > 0) {
    await redis.set(key, JSON.stringify(buildSessionData(user)), "EX", ttl);
  }
};

export const login = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Firebase ID token is required",
      });
    }

    // 1. Verify the Firebase ID token
    let decoded;

    try {
      decoded = await getAuth(app).verifyIdToken(token);
    } catch (error) {
      console.error("Firebase token verification failed:", error.message);

      return res.status(401).json({
        success: false,
        message: "Invalid or expired Firebase token",
      });
    }

    // 2. Find or create the user
    let user = await User.findOne({
      firebaseUID: decoded.uid,
    });

    if (!user) {
      user = await User.create({
        firebaseUID: decoded.uid,
        name: decoded.name || "",
        email: decoded.email || "",
        avatar: decoded.picture || "",
      });
    }

    // 3. Create a Redis session
    const sessionId = crypto.randomUUID();

    const sessionData = buildSessionData(user);

    await redis.set(
      `session:${sessionId}`,
      JSON.stringify(sessionData),
      "EX",
      7 * 24 * 60 * 60,
    );

    // Lets the credit endpoints find this user's session later on.
    await redis.set(
      `user-session:${user._id}`,
      sessionId,
      "EX",
      7 * 24 * 60 * 60,
    );

    // 4. Set the session cookie
    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    // 5. Return user data
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        firebaseUID: user.firebaseUID,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        credits: user.credits,
        totalCredits: user.totalCredits,
        planExpiresAt: user.planExpiresAt,
      },
    });
  } catch (error) {
    console.error("Login controller error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error during login",
    });
  }
};

export const logout = async (req, res) => {
  try {
    const sessionId = req.cookies?.session;

    // Remove the Redis session if one exists
    if (sessionId) {
      await redis.del(`session:${sessionId}`);
    }

    // Clear the browser cookie using matching options
    res.clearCookie("session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout controller error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

export const updateUserPayment = async (req, res) => {
  try {
    if (!isInternalRequest(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { plan, credits, userId, validity, sessionId } = req.body;

    if (!userId || !plan || !Number.isFinite(credits) || credits <= 0) {
      return res.status(400).json({ message: "Invalid payment update" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const days = Number(validity) > 0 ? Number(validity) : 30;

    user.plan = plan;
    user.credits += credits;
    user.totalCredits += credits;
    user.planExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await user.save();

    await refreshSession(user, sessionId);

    return res.status(200).json({ success: true });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Update user payment error ${error}` });
  }
};

const COST = {
  chat: 1,
  search: 5,
  coding: 10,
  pdf: 10,
  ppt: 10,
  vision: 10,
};

// Called by the agent service after a request succeeded.
export const deductCredits = async (req, res) => {
  try {
    if (!isInternalRequest(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { userId, agent } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const requiredCredits = Object.hasOwn(COST, agent) ? COST[agent] : 1;

    // One atomic update: two requests at the same moment can't spend the same
    // credits twice, and the balance can never go below zero.
    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: requiredCredits } },
      { $inc: { credits: -requiredCredits } },
      { new: true },
    );

    if (!user) {
      const exists = await User.exists({ _id: userId });

      return res
        .status(exists ? 402 : 404)
        .json({ message: exists ? "Not enough credit" : "User not found" });
    }

    // Before, a brand-new random session was written here, so the user's real
    // session (and the sidebar) never saw the new balance.
    await refreshSession(user);

    return res.status(200).json({ success: true, credits: user.credits });
  } catch (error) {
    return res.status(500).json({ message: `deduct credits error ${error}` });
  }
};
