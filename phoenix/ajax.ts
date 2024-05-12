import { global as globalNoIE, XHR_STATES } from "./constants";
import type { Global, ParsedJSON, SerializableObject } from "./constants";

export type AjaxRequest = XMLHttpRequest | XDomainRequest;
export type AjaxRequestCallback = (response?: ParsedJSON) => void;
export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE";

// IE8, IE9
export interface XDomainRequest {
  new (): XDomainRequest;
  abort(): () => void;
  timeout: number;
  onload: () => void;
  onerror: () => void;
  onprogress: () => void;
  ontimeout: () => void;
  responseType: string;
  responseText: string;
  open(method: string, url: string): void;
  send(data?: Document | XMLHttpRequestBodyInit | null): void;
}

// IE8, IE9
const global = globalNoIE as Global & {
  XDomainRequest?: XDomainRequest;
};

export default class Ajax {
  static request(
    method: RequestMethod,
    endPoint: string,
    accept: string,
    body: Document | XMLHttpRequestBodyInit | null,
    timeout: number,
    ontimeout: () => void,
    callback: AjaxRequestCallback,
  ): AjaxRequest {
    if (global.XDomainRequest) {
      let req = new global.XDomainRequest(); // IE8, IE9
      return this.xdomainRequest(
        req,
        method,
        endPoint,
        body,
        timeout,
        ontimeout,
        callback,
      );
    } else {
      let req = new self.XMLHttpRequest(); // IE7+, Firefox, Chrome, Opera, Safari
      return this.xhrRequest(
        req,
        method,
        endPoint,
        accept,
        body,
        timeout,
        ontimeout,
        callback,
      );
    }
  }

  static xdomainRequest(
    req: XDomainRequest,
    method: RequestMethod,
    endPoint: string,
    body: Document | XMLHttpRequestBodyInit | null,
    timeout: number,
    ontimeout: () => void,
    callback: AjaxRequestCallback,
  ): XDomainRequest {
    req.timeout = timeout;
    req.open(method, endPoint);
    req.onload = () => {
      let response = this.parseJSON(req.responseText);
      callback(response);
    };
    if (ontimeout) {
      req.ontimeout = ontimeout;
    }

    // Work around bug in IE9 that requires an attached onprogress handler
    req.onprogress = () => {};

    req.send(body);
    return req;
  }

  static xhrRequest(
    req: XMLHttpRequest,
    method: RequestMethod,
    endPoint: string,
    accept: string,
    body: Document | XMLHttpRequestBodyInit | null,
    timeout: number,
    ontimeout: () => void,
    callback: AjaxRequestCallback,
  ): XMLHttpRequest {
    req.open(method, endPoint, true);
    req.timeout = timeout;
    req.setRequestHeader("Content-Type", accept);
    req.onerror = () => callback(null);
    req.onreadystatechange = () => {
      if (req.readyState === XHR_STATES.complete && callback) {
        let response = this.parseJSON(req.responseText);
        callback(response);
      }
    };
    if (ontimeout) {
      req.ontimeout = ontimeout;
    }

    req.send(body);
    return req;
  }

  static parseJSON(resp: string): ParsedJSON {
    if (!resp || resp === "") {
      return null;
    }

    try {
      return JSON.parse(resp);
    } catch (e) {
      console && console.log("failed to parse JSON response", resp);
      return null;
    }
  }

  static serialize(obj: SerializableObject, parentKey?: string): string {
    let queryStr: string[] = [];
    for (let key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        continue;
      }
      let paramKey = parentKey ? `${parentKey}[${key}]` : key;
      let paramVal = obj[key];
      if (typeof paramVal === "object") {
        queryStr.push(this.serialize(paramVal, paramKey));
      } else {
        queryStr.push(
          encodeURIComponent(paramKey) + "=" + encodeURIComponent(paramVal),
        );
      }
    }
    return queryStr.join("&");
  }

  static appendParams(url: string, params: SerializableObject): string {
    if (Object.keys(params).length === 0) {
      return url;
    }

    let prefix = url.match(/\?/) ? "&" : "?";
    return `${url}${prefix}${this.serialize(params)}`;
  }
}
