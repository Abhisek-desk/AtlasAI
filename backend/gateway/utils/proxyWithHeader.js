import proxy from "express-http-proxy";

export const proxyWithHeader = async (serviceUrl) => {
  return proxy(serviceUrl, {
    proxyReqBodyDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.user) {
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      }
    },
  });
};
