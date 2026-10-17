import { getAuth } from "firebase-admin/auth";
import crypto from "node:crypto";

import app from "../config/firebase.js";
import User from "../models/user.model.js";

export const login = async (req, res) => {
try {
const { token } = req.body;

if (!token) {
  return res.status(400).json({
    message: "Firebase ID token is required",
  });
}

// Verify the Firebase ID token.
const decoded = await getAuth(app).verifyIdToken(token);

// Find an existing user.
let user = await User.findOne({
  firebaseUID: decoded.uid,
});

// Create a new user if one doesn't exist.
if (!user) {
  user = await User.create({
    firebaseUID: decoded.uid,
    name: decoded.name,
    email: decoded.email,
    avatar: decoded.picture,
  });
}

// Create a session ID.
const sessionId = crypto.randomUUID();

res.cookie("session", sessionId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
});

return res.status(200).json({
  message: "Login successful",
  user,
});

} catch (error) {
console.error("Login error:", error);


return res.status(401).json({
  message: "Authentication failed",
});


}
};
