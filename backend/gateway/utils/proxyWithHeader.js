import proxy from "express-http-proxy";

export const proxyWithHeader = (serviceUrl, options = {}) => {
  return proxy(serviceUrl, {
    ...options,

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.user) {
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      }

      // Lets the billing service refresh this user's session after a payment.
      if (srcReq.cookies?.session) {
        proxyReqOpts.headers["x-session-id"] = srcReq.cookies.session;
      }

      return proxyReqOpts;
    },
  });
};