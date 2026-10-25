import { getAuth } from "firebase-admin/auth";
import crypto from "node:crypto";

import app from "../config/firebase.js";
import User from "../models/user.model.js";
import redis from "../../../shared/redis/redis.js";

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

    const sessionData = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };

    await redis.set(
      `session:${sessionId}`,
      JSON.stringify(sessionData),
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

// Called by the billing service after a verified payment.
export const updateUserPayment = async (req, res) => {
  try {
    // The gateway exposes /api/auth publicly, so without this check anyone
    // could give themselves credits.
    const secret = process.env.INTERNAL_API_SECRET;
    const received = String(req.headers["x-internal-secret"] || "");

    if (
      !secret ||
      received.length !== secret.length ||
      !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(secret))
    ) {
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

    // Refresh the session of the browser that paid, keeping its remaining
    // lifetime. (Other devices pick the change up the next time they log in.)
    if (sessionId) {
      const key = `session:${sessionId}`;
      const ttl = await redis.ttl(key);

      if (ttl > 0) {
        await redis.set(key, JSON.stringify(buildSessionData(user)), "EX", ttl);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Update user payment error ${error}` });
  }
};
