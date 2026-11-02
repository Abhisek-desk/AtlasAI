import proxy from "express-http-proxy";
import { getSessionId } from "../middleware/auth.middleware.js";

export const proxyWithHeader = (serviceUrl, options = {}) => {
  return proxy(serviceUrl, {
    ...options,

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.user) {
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      }

      // Lets the billing service refresh this user's session after a payment.
      const sessionId = getSessionId(srcReq);

      if (sessionId) {
        proxyReqOpts.headers["x-session-id"] = sessionId;
      }

      return proxyReqOpts;
    },
  });
};