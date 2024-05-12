import Channel from "./channel";
import type { TimerId } from "./timer";

type PushStatus = "ok" | "error" | "timeout";
type ClosuredPayload = () => Record<string | number, unknown>;

/**
 * Initializes the Push
 * @param channel - The Channel
 * @param event - The event, for example `"phx_join"`
 * @param payload - The payload, for example `{user_id: 123}`
 * @param timeout - The push timeout in milliseconds
 */
export default class Push {
  channel: Channel;
  event: string;
  payload: ClosuredPayload;
  ref: string | null = null;
  refEvent: string | null = null;
  receivedResp: Record<string | number, unknown> | null = null;
  timeout: number;
  timeoutTimer: TimerId | null = null;
  recHooks: any[] = [];
  sent: boolean = false;

  constructor(
    channel: Channel,
    event: string,
    payload: ClosuredPayload,
    timeout: number,
  ) {
    this.channel = channel;
    this.event = event;
    this.timeout = timeout;
    this.payload =
      payload ||
      function () {
        return {};
      };
  }

  resend(timeout: number) {
    this.timeout = timeout;
    this.reset();
    this.send();
  }

  send() {
    if (this.hasReceived("timeout")) {
      return;
    }
    this.startTimeout();
    this.sent = true;
    this.channel.socket.push({
      topic: this.channel.topic,
      event: this.event,
      payload: this.payload(),
      ref: this.ref,
      join_ref: this.channel.joinRef(),
    });
  }

  receive(
    status: PushStatus,
    callback: (
      // resp: Record<string | number, unknown> | null | undefined,
      resp?: any,
    ) => unknown,
  ) {
    if (this.hasReceived(status)) {
      callback(this?.receivedResp?.response);
    }

    this.recHooks.push({ status, callback });
    return this;
  }

  private reset() {
    this.cancelRefEvent();
    this.ref = null;
    this.refEvent = null;
    this.receivedResp = null;
    this.sent = false;
  }

  private matchReceive({ status, response, _ref }: any) {
    this.recHooks
      .filter((h) => h.status === status)
      .forEach((h) => h.callback(response));
  }

  private cancelRefEvent() {
    if (!this.refEvent) {
      return;
    }
    this.channel.off(this.refEvent);
  }

  private cancelTimeout() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }
    this.timeoutTimer = null;
  }

  private startTimeout() {
    if (this.timeoutTimer) {
      this.cancelTimeout();
    }
    this.ref = this.channel.socket.makeRef();
    this.refEvent = this.channel.replyEventName(this.ref);

    this.refEvent &&
      this.channel.on(this.refEvent, (payload: any) => {
        this.cancelRefEvent();
        this.cancelTimeout();
        this.receivedResp = payload;
        this.matchReceive(payload);
      });

    this.timeoutTimer = setTimeout(() => {
      this.trigger("timeout", {});
    }, this.timeout);
  }

  private hasReceived(status: PushStatus) {
    return this.receivedResp && this.receivedResp.status === status;
  }

  private trigger(status: PushStatus, response: any) {
    this.channel.trigger(this.refEvent, { status, response });
  }
}
