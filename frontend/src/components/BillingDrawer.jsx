import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "motion/react";
import { AlertCircle, Check, Coins, Sparkles, X } from "lucide-react";

import api from "../../utils/axios.js";
import { getCurrentUser } from "../features/getCurrentUser.js";
import { setUserData } from "../redux/userSlice.js";

// Keep in sync with backend/services/billing/config/plans.js
const PLANS = [
  { id: "free", name: "Free", amount: 0, credits: 100, validity: 30 },
  { id: "starter", name: "Starter", amount: 199, credits: 500, validity: 30 },
  {
    id: "pro",
    name: "Pro",
    amount: 499,
    credits: 1000,
    validity: 30,
    popular: true,
  },
];

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector(`script[src="${RAZORPAY_SRC}"]`);
    const script = existing || document.createElement("script");

    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });

    if (!existing) {
      script.src = RAZORPAY_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const BillingDrawer = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const userData = useSelector((state) => state.user?.userData);

  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const closeButtonRef = useRef(null);

  // Clear old messages whenever the drawer is closed.
  const handleClose = useCallback(() => {
    setError("");
    setSuccess("");
    onClose?.();
  }, [onClose]);

  // Esc closes the drawer, the page behind it doesn't scroll.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") handleClose();
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, handleClose]);

  // Focus the close button once, when the drawer opens.
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const planId = userData?.plan || "free";
  const currentPlan = PLANS.find((plan) => plan.id === planId) || PLANS[0];

  const credits = typeof userData?.credits === "number" ? userData.credits : 0;
  const totalCredits =
    typeof userData?.totalCredits === "number"
      ? userData.totalCredits
      : credits;
  const percent = totalCredits
    ? Math.max(0, Math.min(100, (credits / totalCredits) * 100))
    : 0;

  const expiresAt = userData?.planExpiresAt
    ? new Date(userData.planExpiresAt)
    : null;
  const isExpired = Boolean(expiresAt && expiresAt.getTime() < Date.now());

  const handlePurchase = async (plan) => {
    if (loadingPlan || !userData) return;

    setError("");
    setSuccess("");
    setLoadingPlan(plan.id);

    try {
      const loaded = await loadRazorpay();

      if (!loaded) {
        throw new Error("Could not load Razorpay. Check your connection.");
      }

      const { data } = await api.post("/api/billing/create", { plan: plan.id });

      const key = data?.key || import.meta.env.VITE_RAZORPAY_KEY_ID;

      if (!key || !data?.order?.id) {
        throw new Error("Could not start the payment. Please try again.");
      }

      const checkout = new window.Razorpay({
        key,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: "AtlasAI",
        description: `${plan.name} plan · ${plan.credits} credits`,
        prefill: { name: userData?.name, email: userData?.email },
        theme: { color: "#7C3AED" },

        handler: async (response) => {
          try {
            await api.post("/api/billing/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // The session now holds the new plan and credits.
            const user = await getCurrentUser();

            if (user) dispatch(setUserData(user));

            setSuccess(`${plan.credits} credits were added to your account.`);
          } catch (err) {
            setError(
              err.response?.data?.message ||
                `We received your payment but could not confirm it. Please contact support with payment id ${response.razorpay_payment_id}.`,
            );
          } finally {
            setLoadingPlan(null);
          }
        },

        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
      });

      checkout.on("payment.failed", (response) => {
        setError(response?.error?.description || "The payment failed.");
        setLoadingPlan(null);
      });

      checkout.open();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Something went wrong.",
      );
      setLoadingPlan(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-title"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <motion.aside
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0F172A] text-[#F1F5F9] shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#263247] px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-[#A78BFA]">
              <Coins size={17} />
            </span>
            <h2 id="billing-title" className="text-base font-semibold">
              Credits &amp; plans
            </h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {/* Current balance */}
          <div className="rounded-2xl border border-[#263247] bg-[#111A2E] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#64748B]">
                Current plan
              </p>
              <span className="rounded-md border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                {currentPlan.name}
              </span>
            </div>

            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {credits}
              <span className="ml-1.5 text-sm font-normal text-[#64748B]">
                credits left
              </span>
            </p>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#263247]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#6366F1] transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-[#64748B]">
              {expiresAt
                ? isExpired
                  ? `Plan expired on ${formatDate(expiresAt)}`
                  : `Valid until ${formatDate(expiresAt)}`
                : "No expiry date"}
            </p>
          </div>

          {/* Messages */}
          {success && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-300">
              <Check size={17} className="mt-0.5 shrink-0" />
              <p>{success}</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!userData && (
            <p className="text-sm text-[#94A3B8]">
              Please log in to buy credits.
            </p>
          )}

          {/* Plans */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#64748B]">
              Choose a plan
            </p>

            {PLANS.map((plan) => {
              const isCurrent = plan.id === planId;
              const isFree = plan.amount === 0;
              const isLoading = loadingPlan === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    plan.popular
                      ? "border-violet-400/40 bg-violet-500/5"
                      : "border-[#263247] bg-[#111A2E]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{plan.name}</h3>

                        {plan.popular && (
                          <span className="flex items-center gap-1 rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-200">
                            <Sparkles size={10} />
                            Popular
                          </span>
                        )}

                        {isCurrent && (
                          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#CBD5E1]">
                            Current
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-[#64748B]">
                        {plan.validity}-day validity
                      </p>
                    </div>

                    <p className="text-lg font-semibold">
                      {isFree ? "Free" : `₹${plan.amount}`}
                    </p>
                  </div>

                  <p className="mt-3 flex items-center gap-2 text-sm text-[#CBD5E1]">
                    <Check size={15} className="shrink-0 text-[#A78BFA]" />
                    {plan.credits} credits
                  </p>

                  {!isFree && (
                    <button
                      type="button"
                      onClick={() => handlePurchase(plan)}
                      disabled={Boolean(loadingPlan) || !userData}
                      className={`mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        plan.popular
                          ? "bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-white hover:brightness-110"
                          : "border border-[#263247] bg-[#1E293B] text-[#F1F5F9] hover:bg-[#263247]"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Processing...
                        </>
                      ) : isCurrent ? (
                        `Add ${plan.credits} more credits`
                      ) : (
                        `Get ${plan.name}`
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs leading-5 text-[#64748B]">
            Credits are added to your balance right after the payment is
            confirmed. Payments are processed securely by Razorpay.
          </p>
        </div>
      </motion.aside>
    </div>,
    document.body,
  );
};

export default BillingDrawer;
