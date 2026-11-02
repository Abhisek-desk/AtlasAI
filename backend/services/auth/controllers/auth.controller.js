import { getAuth } from "firebase-admin/auth";
import crypto from "node:crypto";

import app from "../config/firebase.js";
import User from "../models/user.model.js";
import redis from "../../../shared/redis/redis.js";

// Session duration: 7 days.
const SESSION_TTL = 7 * 24 * 60 * 60;

// Configure cookie options consistently for login and logout.
const isProduction = process.env.NODE_ENV === "production";

const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: SESSION_TTL * 1000,
  path: "/",
};

// Options used to clear the cookie must match its original attributes.
const clearSessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

// The session ID comes from the Authorization header (works in every browser)
// or from the cookie.
const getSessionId = (req) => {
  const header = req.headers.authorization || "";

  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }

  return req.cookies?.session;
};

// Data stored in Redis and returned by the gateway's /api/me endpoint.
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

// Verify that a request originates from a trusted internal service.
const isInternalRequest = (req) => {
  const secret = process.env.INTERNAL_API_SECRET;
  const received = String(req.headers["x-internal-secret"] || "");

  if (!secret) {
    console.error(
      "INTERNAL_API_SECRET is missing for internal auth request"
    );
    return false;
  }

  const expectedBuffer = Buffer.from(secret);
  const receivedBuffer = Buffer.from(received);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch (error) {
    console.error("Unable to validate internal auth secret:", error.message);
    return false;
  }
};

// Update an existing Redis session while preserving its remaining TTL.
const refreshSession = async (user, sessionIdHint) => {
  const sessionId =
    sessionIdHint || (await redis.get(`user-session:${user._id}`));

  if (!sessionId) {
    console.warn(`No session found for user ${user._id}`);
    return;
  }

  const key = `session:${sessionId}`;
  const ttl = await redis.ttl(key);

  if (ttl > 0) {
    await redis.set(
      key,
      JSON.stringify(buildSessionData(user)),
      "EX",
      ttl
    );
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { token } = req.body || {};

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        message: "Firebase ID token is required",
      });
    }

    // 1. Verify Firebase ID token.
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

    // 2. Find or create the MongoDB user.
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

    // 3. Create a new session.
    const sessionId = crypto.randomUUID();
    const sessionData = buildSessionData(user);

    // Store the session before issuing the cookie.
    await redis.set(
      `session:${sessionId}`,
      JSON.stringify(sessionData),
      "EX",
      SESSION_TTL
    );

    // Remember the user's most recent session for credit updates.
    await redis.set(
      `user-session:${user._id}`,
      sessionId,
      "EX",
      SESSION_TTL
    );

    // 4. Set the session cookie.
    res.cookie("session", sessionId, sessionCookieOptions);

    // 5. Return user data.
    return res.status(200).json({
      success: true,
      message: "Login successful",
      sessionId,
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

// LOGOUT
export const logout = async (req, res) => {
  try {
    const sessionId = getSessionId(req);

    if (sessionId) {
      // Read the session first, then delete it.
      const sessionData = await redis.get(`session:${sessionId}`);

      await redis.del(`session:${sessionId}`);

      // Delete the user-session mapping only if it points to this session.
      // This avoids deleting a newer session created by another login.
      if (sessionData) {
        const user = JSON.parse(sessionData);
        const mappingKey = `user-session:${user.userId}`;
        const mappedSessionId = await redis.get(mappingKey);

        if (mappedSessionId === sessionId) {
          await redis.del(mappingKey);
        }
      }
    }

    res.clearCookie("session", clearSessionCookieOptions);

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

// UPDATE USER PAYMENT
export const updateUserPayment = async (req, res) => {
  try {
    if (!isInternalRequest(req)) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    const { plan, credits, userId, validity, sessionId } = req.body || {};

    if (
      !userId ||
      !plan ||
      !Number.isFinite(credits) ||
      credits <= 0
    ) {
      return res.status(400).json({
        message: "Invalid payment update",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const days = Number(validity) > 0 ? Number(validity) : 30;

    user.plan = plan;
    user.credits += credits;
    user.totalCredits += credits;
    user.planExpiresAt = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000
    );

    await user.save();

    await refreshSession(user, sessionId);

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Update user payment error:", error);

    return res.status(500).json({
      message: "Unable to update user payment",
    });
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

// DEDUCT CREDITS
export const deductCredits = async (req, res) => {
  try {
    if (!isInternalRequest(req)) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    const { userId, agent } = req.body || {};

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    const requiredCredits = Object.hasOwn(COST, agent)
      ? COST[agent]
      : 1;

    // Atomic update prevents concurrent requests from overspending.
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        credits: { $gte: requiredCredits },
      },
      {
        $inc: { credits: -requiredCredits },
      },
      {
        new: true,
      }
    );

    if (!user) {
      const exists = await User.exists({ _id: userId });

      return res
        .status(exists ? 402 : 404)
        .json({
          message: exists
            ? "Not enough credit"
            : "User not found",
        });
    }

    await refreshSession(user);

    return res.status(200).json({
      success: true,
      credits: user.credits,
    });
  } catch (error) {
    console.error("Deduct credits error:", error);

    return res.status(500).json({
      message: "Unable to deduct credits",
    });
  }
};
