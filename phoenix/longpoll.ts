import Ajax from "./ajax";
import { DEFAULT_TIMEOUT, SOCKET_STATES, TRANSPORTS } from "./constants";
import type { AjaxRequest, AjaxRequestCallback, RequestMethod } from "./ajax";
import type { TimerId } from "./timer";

type PhxResponse = {
  status: number;
  token: string | null;
  messages: Record<string | number, unknown>[];
};

let arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = "";
  let bytes = new Uint8Array(buffer);
  let len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export default class LongPoll {
  endPoint: string | null = null;
  token: string | null = null;
  timeout: number = DEFAULT_TIMEOUT;
  skipHeartbeat: boolean = true;
  reqs: Set<AjaxRequest> = new Set();
  awaitingBatchAck: boolean = false;
  currentBatch: any = null;
  currentBatchTimer: TimerId | null = null;
  batchBuffer: any[] = [];
  pollEndpoint: string;
  readyState: SOCKET_STATES = SOCKET_STATES.connecting;

  onopen: (() => void) | ((event: any) => void);
  onerror: (() => void) | ((error: any) => void);
  onmessage: (() => void) | ((event: any) => void);
  onclose: (() => void) | ((event: any) => void);

  constructor(endPoint: string) {
    this.pollEndpoint = this.normalizeEndpoint(endPoint);
    this.onopen = function () {}; // noop
    this.onerror = function () {}; // noop
    this.onmessage = function () {}; // noop
    this.onclose = function () {}; // noop
    // we must wait for the caller to finish setting up our callbacks and timeout properties
    setTimeout(() => this.poll(), 0);
  }

  normalizeEndpoint(endPoint: string) {
    return endPoint
      .replace("ws://", "http://")
      .replace("wss://", "https://")
      .replace(
        new RegExp("(.*)/" + TRANSPORTS.websocket),
        "$1/" + TRANSPORTS.longpoll,
      );
  }

  endpointURL() {
    return Ajax.appendParams(
      this.pollEndpoint,
      this.token ? { token: this.token } : {},
    );
  }

  closeAndRetry(code: number, reason: string, wasClean: boolean | number) {
    this.close(code, reason, wasClean);
    this.readyState = SOCKET_STATES.connecting;
  }

  ontimeout() {
    this.onerror("timeout");
    this.closeAndRetry(1005, "timeout", false);
  }

  isActive() {
    return (
      this.readyState === SOCKET_STATES.open ||
      this.readyState === SOCKET_STATES.connecting
    );
  }

  poll() {
    this.ajax(
      "GET",
      "application/json",
      null,
      () => this.ontimeout(),
      (resp) => {
        let status = 0;
        let messages: Record<string | number, unknown>[] = [];
        if (resp) {
          let {
            status: respStatus,
            messages: respMessages,
            token,
          } = resp as PhxResponse;
          status = respStatus;
          messages = respMessages;
          this.token = token;
        }

        switch (resp && status) {
          case 200:
            messages.forEach((msg) => {
              // Tasks are what things like event handlers, setTimeout callbacks,
              // promise resolves and more are run within.
              // In modern browsers, there are two different kinds of tasks,
              // microtasks and macrotasks.
              // Microtasks are mainly used for Promises, while macrotasks are
              // used for everything else.
              // Microtasks always have priority over macrotasks. If the JS engine
              // is looking for a task to run, it will always try to empty the
              // microtask queue before attempting to run anything from the
              // macrotask queue.
              //
              // For the WebSocket transport, messages always arrive in their own
              // event. This means that if any promises are resolved from within,
              // their callbacks will always finish execution by the time the
              // next message event handler is run.
              //
              // In order to emulate this behaviour, we need to make sure each
              // onmessage handler is run within its own macrotask.
              setTimeout(() => this.onmessage({ data: msg }), 0);
            });
            this.poll();
            break;
          case 204:
            this.poll();
            break;
          case 410:
            this.readyState = SOCKET_STATES.open;
            this.onopen({});
            this.poll();
            break;
          case 403:
            this.onerror(403);
            this.close(1008, "forbidden", false);
            break;
          case 0:
          case 500:
            this.onerror(500);
            this.closeAndRetry(1011, "internal server error", 500);
            break;
          default:
            throw new Error(`unhandled poll status ${status}`);
        }
      },
    );
  }

  // we collect all pushes within the current event loop by
  // setTimeout 0, which optimizes back-to-back procedural
  // pushes against an empty buffer

  send(body: string | ArrayBuffer) {
    if (typeof body !== "string") {
      body = arrayBufferToBase64(body);
    }
    if (this.currentBatch) {
      this.currentBatch.push(body);
    } else if (this.awaitingBatchAck) {
      this.batchBuffer.push(body);
    } else {
      this.currentBatch = [body];
      this.currentBatchTimer = setTimeout(() => {
        this.batchSend(this.currentBatch);
        this.currentBatch = null;
      }, 0);
    }
  }

  batchSend(messages: string[] | ArrayBuffer[]) {
    this.awaitingBatchAck = true;
    this.ajax(
      "POST",
      "application/x-ndjson",
      messages.join("\n"),
      () => this.onerror("timeout"),
      (resp) => {
        const phxResp = resp as PhxResponse;
        this.awaitingBatchAck = false;
        if (!phxResp || phxResp.status !== 200) {
          this.onerror(phxResp && phxResp.status);
          this.closeAndRetry(1011, "internal server error", false);
        } else if (this.batchBuffer.length > 0) {
          this.batchSend(this.batchBuffer);
          this.batchBuffer = [];
        }
      },
    );
  }

  close(code: number, reason: string, wasClean: boolean | number) {
    for (let req of this.reqs) {
      req.abort();
    }
    this.readyState = SOCKET_STATES.closed;
    let opts = Object.assign(
      { code: 1000, reason: undefined, wasClean: true },
      { code, reason, wasClean },
    );
    this.batchBuffer = [];
    this.currentBatchTimer && clearTimeout(this.currentBatchTimer);
    this.currentBatchTimer = null;
    if (typeof CloseEvent !== "undefined") {
      this.onclose(new CloseEvent("close", opts));
    } else {
      this.onclose(opts);
    }
  }

  ajax(
    method: RequestMethod,
    contentType: string,
    body: Document | XMLHttpRequestBodyInit | null,
    onCallerTimeout: () => void,
    callback: AjaxRequestCallback,
  ) {
    let req: AjaxRequest;
    let ontimeout = () => {
      this.reqs.delete(req);
      onCallerTimeout();
    };
    req = Ajax.request(
      method,
      this.endpointURL(),
      contentType,
      body,
      this.timeout,
      ontimeout,
      (resp) => {
        this.reqs.delete(req);
        if (this.isActive()) {
          callback(resp);
        }
      },
    );
    this.reqs.add(req);
  }
}
