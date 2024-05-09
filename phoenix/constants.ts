export const globalSelf = typeof self !== "undefined" ? self : null;
export const phxWindow = typeof window !== "undefined" ? window : null;
export const global: Window = globalSelf || phxWindow || ({} as Window);
export const DEFAULT_VSN = "2.0.0";
export const DEFAULT_TIMEOUT = 10000;
export const WS_CLOSE_NORMAL = 1000;
export enum SOCKET_STATES {
  connecting = 0,
  open = 1,
  closing = 2,
  closed = 3,
}
export enum CHANNEL_STATES {
  closed = "closed",
  errored = "errored",
  joined = "joined",
  joining = "joining",
  leaving = "leaving",
}
export enum CHANNEL_EVENTS {
  close = "phx_close",
  error = "phx_error",
  join = "phx_join",
  reply = "phx_reply",
  leave = "phx_leave",
}

export enum TRANSPORTS {
  longpoll = "longpoll",
  websocket = "websocket",
}
export enum XHR_STATES {
  complete = 4,
}
