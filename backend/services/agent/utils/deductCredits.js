import axios from "axios";

const deductCredits = async (userId, agent) => {
  try {
    const { data } = await axios.post(
      `${process.env.AUTH_SERVICE}/auth/deduct-credit`,
      { userId, agent },
      { headers: { "x-internal-secret": process.env.INTERNAL_API_SECRET } },
    );
    return data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data || {
      message: "Could not deduct credits for this request.",
    };

    console.error("Credit deduction failed:", data);
    // Preserve the HTTP status so the gateway can return 402/403 instead of
    // silently allowing a successful but uncharged request.
    if (status) {
      error.status = status;
      error.data = data;
    }
    throw error;
  }
};

export default deductCredits;
