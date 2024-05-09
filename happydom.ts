import { GlobalRegistrator } from "@happy-dom/global-registrator";

// workaround for a bug with bun + happy-dom: https://github.com/oven-sh/bun/issues/8774
import HTTP, { request as HTTPRequest } from "http";
import HTTPS, { request as HTTPSRequest } from "https";

type RequestParams = Parameters<typeof HTTPRequest>;

HTTP.request = function (...args: any[]) {
  return Object.assign(HTTPRequest(...(args as RequestParams)), {
    end() {},
  });
};

HTTPS.request = function (...args: any[]) {
  return Object.assign(HTTPSRequest(...(args as RequestParams)), {
    end() {},
  });
};
// end workaround

GlobalRegistrator.register();
