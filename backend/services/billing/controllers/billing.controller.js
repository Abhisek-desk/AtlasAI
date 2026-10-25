import crypto from "node:crypto";
import axios from "axios";
import { PLANS } from "../config/plans.js";
import razorpay from "../config/razorpay.js";
import Payment from "../models/payment.model.js";

export const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.headers["x-user-id"];
    const selectedPlan = PLANS[plan];

    if (!selectedPlan) {
      return res.status(404).json({ message: "plan not found" });
    }

    // Razorpay rejects zero-amount orders, and the free plan needs no payment.
    if (selectedPlan.amount <= 0) {
      return res
        .status(400)
        .json({ message: "The free plan cannot be purchased" });
    }

    const order = await razorpay.orders.create({
      amount: selectedPlan.amount * 100,
      currency: "INR",
      receipt: `receipt-${Date.now()}`,
    });

    await Payment.create({
      userId,
      orderId: order.id,
      amount: selectedPlan.amount,
      credits: selectedPlan.credits,
      plan: selectedPlan.id,
      currency: order.currency,
      status: "created",
    });

    // The key id is public; sending it saves a frontend env variable.
    return res
      .status(200)
      .json({ order, plan: selectedPlan, key: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    return res.status(500).json({ message: `create order error ${error}` });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const sessionId = req.headers["x-session-id"];
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    const expected = Buffer.from(
      crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex"),
    );
    const received = Buffer.from(String(razorpay_signature));

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return res.status(400).json({ message: "Payment Verification Failed" });
    }

    // Mark the order paid exactly once, and only for the user who created it.
    let payment = await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id, userId, status: { $ne: "paid" } },
      { status: "paid", paymentId: razorpay_payment_id },
      { new: true },
    );

    if (!payment) {
      payment = await Payment.findOne({ orderId: razorpay_order_id, userId });

      if (!payment) {
        return res.status(404).json({ message: "Payment Not Found" });
      }

      // A repeated verify call must not hand out the credits twice.
      if (payment.creditsApplied) {
        return res.status(200).json({ message: "Payment already verified" });
      }
    }

    await axios.post(
      `${process.env.AUTH_SERVICE}/auth/update-plan`,
      {
        userId: payment.userId,
        plan: payment.plan,
        credits: payment.credits,
        validity: PLANS[payment.plan]?.validity,
        sessionId,
      },
      { headers: { "x-internal-secret": process.env.INTERNAL_API_SECRET } },
    );

    payment.creditsApplied = true;
    await payment.save();

    return res.status(200).json({ message: "Payment verified" });
  } catch (error) {
    return res.status(500).json({
      message: `Verify payment error ${error.response?.data?.message || error.message}`,
    });
  }
};