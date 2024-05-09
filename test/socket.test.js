import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";

import sinon from "sinon";
import { WebSocket, Server as WebSocketServer } from "mock-socket";
import { encode } from "./serializer";
import { Socket, LongPoll } from "../dist";

let socket;

describe("with transports", function () {
  beforeAll(function () {
    global.WebSocket = WebSocket;
  });

  describe("constructor", function () {
    it("sets defaults", function () {
      socket = new Socket("/socket");

      expect(socket.channels.length).toEqual(0);
      expect(socket.sendBuffer.length).toEqual(0);
      expect(socket.ref).toEqual(0);
      expect(socket.endPoint).toEqual("/socket/websocket");
      expect(socket.stateChangeCallbacks).toStrictEqual({
        open: [],
        close: [],
        error: [],
        message: [],
      });
      expect(socket.transport).toEqual(WebSocket);
      expect(socket.timeout).toEqual(10000);
      expect(socket.longpollerTimeout).toEqual(20000);
      expect(socket.heartbeatIntervalMs).toEqual(30000);
      expect(socket.logger).toEqual(null);
      expect(socket.binaryType).toEqual("arraybuffer");
      expect(typeof socket.reconnectAfterMs).toEqual("function");
    });

    it("supports closure or literal params", function () {
      socket = new Socket("/socket", { params: { one: "two" } });
      expect(socket.params()).toStrictEqual({ one: "two" });

      socket = new Socket("/socket", {
        params: function () {
          return { three: "four" };
        },
      });
      expect(socket.params()).toStrictEqual({ three: "four" });
    });

    it("overrides some defaults with options", function () {
      const customTransport = function transport() {};
      const customLogger = function logger() {};
      const customReconnect = function reconnect() {};

      socket = new Socket("/socket", {
        timeout: 40000,
        longpollerTimeout: 50000,
        heartbeatIntervalMs: 60000,
        transport: customTransport,
        logger: customLogger,
        reconnectAfterMs: customReconnect,
        params: { one: "two" },
      });

      expect(socket.timeout).toEqual(40000);
      expect(socket.longpollerTimeout).toEqual(50000);
      expect(socket.heartbeatIntervalMs).toEqual(60000);
      expect(socket.transport).toEqual(customTransport);
      expect(socket.logger).toEqual(customLogger);
      expect(socket.params()).toStrictEqual({ one: "two" });
    });

    describe("with Websocket", function () {
      it("defaults to Websocket transport if available", function () {
        let mockServer;
        mockServer = new WebSocketServer("wss://example.com/");
        socket = new Socket("/socket");
        expect(socket.transport).toEqual(WebSocket);
        mockServer.stop();
      });
    });

    describe("longPollFallbackMs", function () {
      it("falls back to longpoll when set after primary transport failure", function () {
        let mockServer;
        socket = new Socket("/socket", { longPollFallbackMs: 20 });
        let replaceSpy = sinon.spy(socket, "replaceTransport");
        mockServer = new WebSocketServer("wss://example.test/");
        mockServer.stop(() => {
          expect(socket.transport).toEqual(WebSocket);
          socket.onError((reason) => {
            setTimeout(() => {
              expect(replaceSpy.calledWith(LongPoll)).toBeTruthy();
            }, 100);
          });
          socket.connect();
        });
      });
    });
  });

  describe("protocol", function () {
    beforeEach(function () {
      socket = new Socket("/socket");
    });

    it("returns wss when location.protocol is https", async function () {
      global.happyDOM.setURL("https://example.com/");

      expect(socket.protocol()).toEqual("wss");
    });

    it("returns ws when location.protocol is http", function () {
      global.happyDOM.setURL("http://example.com/");

      expect(socket.protocol()).toEqual("ws");
    });
  });

  describe("endpointURL", function () {
    it("returns endpoint for given full url", function () {
      global.happyDOM.setURL("https://example.com/");
      socket = new Socket("wss://example.org/chat");

      expect(socket.endPointURL()).toEqual(
        "wss://example.org/chat/websocket?vsn=2.0.0",
      );
    });

    it("returns endpoint for given protocol-relative url", function () {
      global.happyDOM.setURL("https://example.com/");
      socket = new Socket("//example.org/chat");

      expect(socket.endPointURL()).toEqual(
        "wss://example.org/chat/websocket?vsn=2.0.0",
      );
    });

    it("returns endpoint for given path on https host", function () {
      global.happyDOM.setURL("https://example.com/");
      socket = new Socket("/socket");

      expect(socket.endPointURL()).toEqual(
        "wss://example.com/socket/websocket?vsn=2.0.0",
      );
    });

    it("returns endpoint for given path on http host", function () {
      global.happyDOM.setURL("http://example.com/");
      socket = new Socket("/socket");

      expect(socket.endPointURL()).toEqual(
        "ws://example.com/socket/websocket?vsn=2.0.0",
      );
    });
  });

  describe("connect with WebSocket", function () {
    let mockServer;

    beforeEach(function () {
      mockServer = new WebSocketServer("wss://example.com/");
      socket = new Socket("/socket");
    });

    afterEach(function () {
      mockServer.stop();
    });

    it("establishes websocket connection with endpoint", function () {
      socket.connect();

      let conn = socket.conn;
      expect(conn instanceof global.WebSocket).toBeTruthy();
      expect(conn.url).toEqual(socket.endPointURL());
    });

    it("sets callbacks for connection", function () {
      let opens = 0;
      socket.onOpen(() => ++opens);
      let closes = 0;
      socket.onClose(() => ++closes);
      let lastError;
      socket.onError((error) => (lastError = error));
      let lastMessage;
      socket.onMessage((message) => (lastMessage = message.payload));

      socket.connect();

      console.log("socketConn", socket.conn.onopen);
      socket.conn.onopen();
      expect(opens).toEqual(1);

      socket.conn.onclose();
      expect(closes).toEqual(1);

      socket.conn.onerror("error");
      expect(lastError).toEqual("error");

      const data = {
        topic: "topic",
        event: "event",
        payload: "payload",
        status: "ok",
      };
      socket.conn.onmessage({ data: encode(data) });
      expect(lastMessage).toEqual("payload");
    });

    it("is idempotent", function () {
      socket.connect();

      let conn = socket.conn;

      socket.connect();

      expect(conn).toStrictEqual(socket.conn);
    });
  });

  describe("connect with long poll", function () {
    beforeEach(function () {
      socket = new Socket("/socket", { transport: LongPoll });
    });

    it("establishes long poll connection with endpoint", function () {
      socket.connect();

      let conn = socket.conn;
      expect(conn instanceof LongPoll).toBeTruthy();
      expect(conn.pollEndpoint).toEqual(
        "http://example.com/socket/longpoll?vsn=2.0.0",
      );
      expect(conn.timeout).toEqual(20000);
    });

    it("sets callbacks for connection", function () {
      let opens = 0;
      socket.onOpen(() => ++opens);
      let closes = 0;
      socket.onClose(() => ++closes);
      let lastError;
      socket.onError((error) => (lastError = error));
      let lastMessage;
      socket.onMessage((message) => (lastMessage = message.payload));

      socket.connect();

      socket.conn.onopen();
      expect(opens).toEqual(1);

      socket.conn.onclose();
      expect(closes).toEqual(1);

      socket.conn.onerror("error");

      expect(lastError).toEqual("error");

      socket.connect();

      const data = {
        topic: "topic",
        event: "event",
        payload: "payload",
        status: "ok",
      };

      socket.conn.onmessage({ data: encode(data) });
      expect(lastMessage).toEqual("payload");
    });

    it("is idempotent", function () {
      socket.connect();

      let conn = socket.conn;

      socket.connect();

      expect(conn).toStrictEqual(socket.conn);
    });
  });

  describe("disconnect", function () {
    let mockServer;

    beforeEach(function () {
      mockServer = new WebSocketServer("wss://example.com/");
      socket = new Socket("/socket");
    });

    afterEach(function () {
      mockServer.stop();
    });

    it("removes existing connection", function () {
      socket.connect();
      socket.disconnect();
      socket.disconnect(() => {
        expect(socket.conn).toBeNull();
      });
    });

    it("calls callback", function () {
      let count = 0;
      socket.connect();
      socket.disconnect(() => {
        count++;
        expect(count).toEqual(1);
      });
    });

    it("calls connection close callback", function () {
      socket.connect();
      const spy = sinon.spy(socket.conn, "close");

      socket.disconnect(
        () => {
          expect(spy.calledWith(1000, "reason")).toBe(true);
        },
        1000,
        "reason",
      );
    });

    it("does not throw when no connection", function () {
      expect(() => {
        socket.disconnect();
      }).not.toThrow();
    });
  });

  describe("connectionState", function () {
    beforeEach(function () {
      socket = new Socket("/socket");
    });

    it("defaults to closed", function () {
      expect(socket.connectionState()).toEqual("closed");
    });

    it("returns closed if readyState unrecognized", function () {
      socket.connect();

      socket.conn.readyState = 5678;
      expect(socket.connectionState()).toEqual("closed");
    });

    it("returns connecting", function () {
      socket.connect();

      socket.conn.readyState = 0;
      expect(socket.connectionState()).toEqual("connecting");
      // assert.ok(!socket.isConnected(), "is not connected");
      expect(!socket.isConnected()).toBeTruthy("is not connected");
    });

    it("returns open", function () {
      socket.connect();

      socket.conn.readyState = 1;
      expect(socket.connectionState()).toEqual("open");
      expect(socket.isConnected()).toBeTruthy();
    });

    it("returns closing", function () {
      socket.connect();

      socket.conn.readyState = 2;
      expect(socket.connectionState()).toEqual("closing");
      expect(!socket.isConnected()).toBeTruthy();
    });

    it("returns closed", function () {
      socket.connect();

      socket.conn.readyState = 3;
      expect(socket.connectionState()).toEqual("closed");
      expect(!socket.isConnected()).toBeTruthy();
    });
  });

  describe("channel", function () {
    let channel;

    beforeEach(function () {
      socket = new Socket("/socket");
    });

    it("returns channel with given topic and params", function () {
      channel = socket.channel("topic", { one: "two" });

      expect(channel.socket).toStrictEqual(socket);
      expect(channel.topic).toEqual("topic");
      expect(channel.params()).toStrictEqual({ one: "two" });
    });

    it("adds channel to sockets channels list", function () {
      expect(socket.channels.length).toEqual(0);

      channel = socket.channel("topic", { one: "two" });

      expect(socket.channels.length).toEqual(1);

      const [foundChannel] = socket.channels;
      expect(foundChannel).toStrictEqual(channel);
    });
  });

  describe("remove", function () {
    it("removes given channel from channels", function () {
      socket = new Socket("/socket");
      const channel1 = socket.channel("topic-1");
      const channel2 = socket.channel("topic-2");

      sinon.stub(channel1, "joinRef").returns(1);
      sinon.stub(channel2, "joinRef").returns(2);

      expect(socket.stateChangeCallbacks.open.length).toEqual(2);

      socket.remove(channel1);

      expect(socket.stateChangeCallbacks.open.length).toEqual(1);

      expect(socket.channels.length).toEqual(1);

      const [foundChannel] = socket.channels;
      expect(foundChannel).toStrictEqual(channel2);
    });
  });

  describe("push", function () {
    let data, json;

    beforeEach(function () {
      data = { topic: "topic", event: "event", payload: "payload", ref: "ref" };
      json = encode(data);
      socket = new Socket("/socket");
    });

    it("sends data to connection when connected", function () {
      socket.connect();
      socket.conn.readyState = 1; // open

      const spy = sinon.spy(socket.conn, "send");

      socket.push(data);

      expect(spy.calledWith(json)).toBeTruthy();
    });

    it("buffers data when not connected", function () {
      socket.connect();
      socket.conn.readyState = 0; // connecting

      const spy = sinon.spy(socket.conn, "send");

      expect(socket.sendBuffer.length).toEqual(0);

      socket.push(data);

      expect(spy.neverCalledWith(json)).toBeTruthy();
      expect(socket.sendBuffer.length).toEqual(1);

      // NOTE: this was failing as originally written as the websocket
      // send failed because we didn't finish connecting, so...
      socket.conn.readyState = 1; // open connection

      const [callback] = socket.sendBuffer;
      callback();
      expect(spy.calledWith(json)).toBeTruthy();
    });
  });

  describe("makeRef", function () {
    beforeEach(function () {
      socket = new Socket("/socket");
    });

    it("returns next message ref", function () {
      expect(socket.ref).toStrictEqual(0);
      expect(socket.makeRef()).toStrictEqual("1");
      expect(socket.ref).toStrictEqual(1);
      expect(socket.makeRef()).toStrictEqual("2");
      expect(socket.ref).toStrictEqual(2);
    });

    it("restarts for overflow", function () {
      socket.ref = Number.MAX_SAFE_INTEGER + 1;

      expect(socket.makeRef()).toStrictEqual("0");
      expect(socket.ref).toStrictEqual(0);
    });
  });

  describe("sendHeartbeat", function () {
    beforeEach(function () {
      socket = new Socket("/socket");
      socket.connect();
    });

    it("closes socket when heartbeat is not ack'd within heartbeat window", function () {
      let clock = sinon.useFakeTimers();
      let closed = false;
      socket.conn.readyState = 1; // open
      socket.conn.close = () => (closed = true);
      socket.sendHeartbeat();
      expect(closed).toStrictEqual(false);

      clock.tick(10000);
      expect(closed).toStrictEqual(false);

      clock.tick(20010);
      expect(closed).toStrictEqual(true);

      clock.restore();
    });

    it("pushes heartbeat data when connected", function () {
      socket.conn.readyState = 1; // open

      const spy = sinon.spy(socket.conn, "send");
      const data = '[null,"1","phoenix","heartbeat",{}]';

      socket.sendHeartbeat();
      expect(spy.calledWith(data)).toBeTruthy();
    });

    it("no ops when not connected", function () {
      socket.conn.readyState = 0; // connecting

      const spy = sinon.spy(socket.conn, "send");
      const data = encode({
        topic: "phoenix",
        event: "heartbeat",
        payload: {},
        ref: "1",
      });

      socket.sendHeartbeat();
      expect(spy.neverCalledWith(data)).toBeTruthy();
    });
  });

  describe("flushSendBuffer", function () {
    beforeEach(function () {
      socket = new Socket("/socket");
      socket.connect();
    });

    it("calls callbacks in buffer when connected", function () {
      socket.conn.readyState = 1; // open
      const spy1 = sinon.spy();
      const spy2 = sinon.spy();
      const spy3 = sinon.spy();
      socket.sendBuffer.push(spy1);
      socket.sendBuffer.push(spy2);

      socket.flushSendBuffer();

      expect(spy1.callCount).toBeTruthy();
      expect(spy2.callCount).toBeTruthy();
      expect(spy3.callCount).toEqual(0);
    });

    it("empties sendBuffer", function () {
      socket.conn.readyState = 1; // open
      socket.sendBuffer.push(() => {});

      socket.flushSendBuffer();

      expect(socket.sendBuffer.length).toStrictEqual(0);
    });
  });

  describe("onConnOpen", function () {
    let mockServer;

    beforeEach(function () {
      mockServer = new WebSocketServer("wss://example.com/");
      socket = new Socket("/socket", {
        reconnectAfterMs: () => 100000,
      });
      socket.connect();
    });

    afterEach(function () {
      mockServer.stop();
    });

    it("flushes the send buffer", function () {
      socket.conn.readyState = 1; // open
      const spy = sinon.spy();
      socket.sendBuffer.push(spy);

      socket.onConnOpen();

      expect(spy.calledOnce).toBeTruthy();
    });

    it("resets reconnectTimer", function () {
      const spy = sinon.spy(socket.reconnectTimer, "reset");

      socket.onConnOpen();

      expect(spy.calledOnce).toBeTruthy();
    });

    it("triggers onOpen callback", function () {
      const spy = sinon.spy();

      socket.onOpen(spy);

      socket.onConnOpen();

      expect(spy.calledOnce).toBeTruthy();
    });
  });

  describe("onConnClose", function () {
    let mockServer;

    beforeEach(function () {
      mockServer = new WebSocketServer("wss://example.com/");
      socket = new Socket("/socket", {
        reconnectAfterMs: () => 100000,
      });
      socket.connect();
    });

    afterEach(function () {
      mockServer.stop();
    });

    it("does not schedule reconnectTimer if normal close", function () {
      const spy = sinon.spy(socket.reconnectTimer, "scheduleTimeout");

      const event = { code: 1000 };

      socket.onConnClose(event);

      expect(spy.calledOnce).toBeFalse();
    });

    it("schedules reconnectTimer timeout if abnormal close", function () {
      const spy = sinon.spy(socket.reconnectTimer, "scheduleTimeout");

      const event = { code: 1006 };

      socket.onConnClose(event);

      expect(spy.calledOnce).toBeTruthy();
    });

    it("does not schedule reconnectTimer timeout if normal close after explicit disconnect", function () {
      const spy = sinon.spy(socket.reconnectTimer, "scheduleTimeout");

      socket.disconnect();

      expect(spy.notCalled).toBeTruthy();
    });

    it("schedules reconnectTimer timeout if not normal close", function () {
      const spy = sinon.spy(socket.reconnectTimer, "scheduleTimeout");

      const event = { code: 1001 };

      socket.onConnClose(event);

      expect(spy.calledOnce).toBeTruthy();
    });

    it("schedules reconnectTimer timeout if connection cannot be made after a previous clean disconnect", function () {
      const spy = sinon.spy(socket.reconnectTimer, "scheduleTimeout");

      socket.disconnect(() => {
        socket.connect();

        const event = { code: 1001 };

        socket.onConnClose(event);

        expect(spy.calledOnce).toBeTruthy();
      });
    });

    it("triggers onClose callback", function () {
      const spy = sinon.spy();

      socket.onClose(spy);

      socket.onConnClose("event");

      expect(spy.calledWith("event")).toBeTruthy();
    });

    it("triggers channel error if joining", function () {
      const channel = socket.channel("topic");
      const spy = sinon.spy(channel, "trigger");
      channel.join();
      expect(channel.state).toEqual("joining");

      socket.onConnClose();

      expect(spy.calledWith("phx_error")).toBeTruthy();
    });

    it("triggers channel error if joined", function () {
      const channel = socket.channel("topic");
      const spy = sinon.spy(channel, "trigger");
      channel.join().trigger("ok", {});

      expect(channel.state).toEqual("joined");

      socket.onConnClose();

      expect(spy.calledWith("phx_error")).toBeTruthy();
    });

    it("does not trigger channel error after leave", function () {
      const channel = socket.channel("topic");
      const spy = sinon.spy(channel, "trigger");
      channel.join().trigger("ok", {});
      channel.leave();
      expect(channel.state).toEqual("closed");

      socket.onConnClose();

      expect(!spy.calledWith("phx_error")).toBeTruthy();
    });

    it("does not send heartbeat after explicit disconnect", function () {
      let clock = sinon.useFakeTimers();
      const spy = sinon.spy(socket, "sendHeartbeat");
      socket.onConnOpen();
      socket.disconnect();
      clock.tick(30000);
      expect(spy.notCalled).toBeTruthy();
      clock.restore();
    });

    it("does not timeout the heartbeat after explicit disconnect", function () {
      let clock = sinon.useFakeTimers();
      const spy = sinon.spy(socket, "heartbeatTimeout");
      socket.onConnOpen();
      socket.disconnect();
      clock.tick(30000);
      clock.tick(30000);
      expect(spy.notCalled).toBeTruthy();
      clock.restore();
    });
  });

  describe("onConnError", function () {
    let mockServer;

    beforeEach(function () {
      mockServer = new WebSocketServer("wss://example.com/");
      socket = new Socket("/socket", {
        reconnectAfterMs: () => 100000,
      });
      socket.connect();
    });

    afterEach(function () {
      mockServer.stop();
    });

    it("triggers onClose callback", function () {
      const spy = sinon.spy();

      socket.onError(spy);

      socket.onConnError("error");

      expect(spy.calledWith("error")).toBeTruthy();
    });

    it("triggers channel error if joining with open connection", function () {
      const channel = socket.channel("topic");
      const spy = sinon.spy(channel, "trigger");
      channel.join();
      socket.onConnOpen();

      expect(channel.state).toEqual("joining");

      socket.onConnError("error");

      expect(spy.calledWith("phx_error")).toBeTruthy();
    });

    it("triggers channel error if joining with no connection", function () {
      const channel = socket.channel("topic");
      const spy = sinon.spy(channel, "trigger");
      channel.join();

      expect(channel.state).toEqual("joining");

      socket.onConnError("error");

      expect(spy.calledWith("phx_error")).toBeTruthy();
    });

    it("triggers channel error if joined", function () {
      const channel = socket.channel("topic");
      const spy = sinon.spy(channel, "trigger");
      channel.join().trigger("ok", {});
      socket.onConnOpen();

      expect(channel.state).toEqual("joined");

      let connectionsCount = null;
      let transport = null;
      socket.onError((error, erroredTransport, conns) => {
        transport = erroredTransport;
        connectionsCount = conns;
      });

      socket.onConnError("error");

      expect(transport).toEqual(WebSocket);
      expect(connectionsCount).toEqual(1);
      expect(spy.calledWith("phx_error")).toBeTruthy();
    });

    it("does not trigger channel error after leave", function () {
      const channel = socket.channel("topic");
      const spy = sinon.spy(channel, "trigger");
      channel.join().trigger("ok", {});
      channel.leave();
      expect(channel.state).toEqual("closed");

      socket.onConnError("error");

      expect(!spy.calledWith("phx_error")).toBeTruthy();
    });

    it("does not trigger channel error if transport replaced with no previous connection", function () {
      const channel = socket.channel("topic");
      const spy = sinon.spy(channel, "trigger");
      channel.join();

      expect(channel.state).toEqual("joining");

      let connectionsCount = null;
      class FakeTransport {}

      socket.onError((error, transport, conns) => {
        socket.replaceTransport(FakeTransport);
        connectionsCount = conns;
      });
      socket.onConnError("error");

      expect(connectionsCount).toEqual(0);
      expect(socket.transport).toEqual(FakeTransport);
      expect(spy.calledWith("phx_error")).toBeFalse();
    });
  });

  describe("onConnMessage", function () {
    let mockServer;

    beforeEach(function () {
      mockServer = new WebSocketServer("wss://example.com/");
      socket = new Socket("/socket", {
        reconnectAfterMs: () => 100000,
      });
      socket.connect();
    });

    afterEach(function () {
      mockServer.stop();
    });

    it("parses raw message and triggers channel event", function () {
      const message = encode({
        topic: "topic",
        event: "event",
        payload: "payload",
        ref: "ref",
      });
      const data = { data: message };

      const targetChannel = socket.channel("topic");
      const otherChannel = socket.channel("off-topic");

      const targetSpy = sinon.spy(targetChannel, "trigger");
      const otherSpy = sinon.spy(otherChannel, "trigger");

      socket.onConnMessage(data);

      expect(targetSpy.calledWith("event", "payload", "ref")).toBeTruthy();
      expect(targetSpy.callCount).toEqual(1);
      expect(otherSpy.callCount).toEqual(0);
    });

    it("triggers onMessage callback", function () {
      const message = {
        topic: "topic",
        event: "event",
        payload: "payload",
        ref: "ref",
      };
      const spy = sinon.spy();
      socket.onMessage(spy);
      socket.onConnMessage({ data: encode(message) });

      expect(
        spy.calledWith({
          topic: "topic",
          event: "event",
          payload: "payload",
          ref: "ref",
          join_ref: null,
        }),
      ).toBeTruthy();
    });
  });

  describe("ping", function () {
    beforeEach(function () {
      socket = new Socket("/socket");
      socket.connect();
    });

    it("pushes when connected", function () {
      let latency = 100;
      socket.conn.readyState = 1; // open
      expect(socket.isConnected()).toBeTrue();
      socket.push = (msg) => {
        setTimeout(() => {
          socket.onConnMessage({
            data: encode({
              topic: "phoenix",
              event: "phx_reply",
              ref: msg.ref,
            }),
          });
        }, latency);
      };

      let result = socket.ping((rtt) => {
        expect(rtt >= latency).toBeTrue();
      });
      expect(result).toBeTrue();
    });

    it("returns false when disconnected", function () {
      socket.conn.readyState = 0;
      expect(socket.isConnected()).toBeFalse();
      let result = socket.ping((rtt) => true);
      expect(result).toBeFalse();
    });
  });

  describe("custom encoder and decoder", function () {
    it("encodes to JSON array by default", function () {
      socket = new Socket("/socket");
      let payload = {
        topic: "topic",
        ref: "2",
        join_ref: "1",
        event: "join",
        payload: { foo: "bar" },
      };

      socket.encode(payload, (encoded) => {
        expect(encoded).toStrictEqual('["1","2","topic","join",{"foo":"bar"}]');
      });
    });

    it("allows custom encoding when using WebSocket transport", function () {
      let encoder = (payload, callback) => callback("encode works");
      socket = new Socket("/socket", { transport: WebSocket, encode: encoder });

      socket.encode({ foo: "bar" }, (encoded) => {
        expect(encoded).toStrictEqual("encode works");
      });
    });

    it("forces JSON encoding when using LongPoll transport", function () {
      let encoder = (payload, callback) => callback("encode works");
      socket = new Socket("/socket", { transport: LongPoll, encode: encoder });
      let payload = {
        topic: "topic",
        ref: "2",
        join_ref: "1",
        event: "join",
        payload: { foo: "bar" },
      };

      socket.encode(payload, (encoded) => {
        expect(encoded).toStrictEqual('["1","2","topic","join",{"foo":"bar"}]');
      });
    });

    it("decodes JSON by default", function () {
      socket = new Socket("/socket");
      let encoded = '["1","2","topic","join",{"foo":"bar"}]';

      socket.decode(encoded, (decoded) => {
        expect(decoded).toStrictEqual({
          topic: "topic",
          ref: "2",
          join_ref: "1",
          event: "join",
          payload: { foo: "bar" },
        });
      });
    });

    it("allows custom decoding when using WebSocket transport", function () {
      let decoder = (payload, callback) => callback("decode works");
      socket = new Socket("/socket", { transport: WebSocket, decode: decoder });

      socket.decode("...esoteric format...", (decoded) => {
        expect(decoded).toStrictEqual("decode works");
      });
    });

    it("forces JSON decoding when using LongPoll transport", function () {
      let decoder = (payload, callback) => callback("decode works");
      socket = new Socket("/socket", { transport: LongPoll, decode: decoder });
      let payload = {
        topic: "topic",
        ref: "2",
        join_ref: "1",
        event: "join",
        payload: { foo: "bar" },
      };

      socket.decode('["1","2","topic","join",{"foo":"bar"}]', (decoded) => {
        expect(decoded).toStrictEqual(payload);
      });
    });
  });
});

global.WebSocket = WebSocket;
