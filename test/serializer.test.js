import { describe, expect, it } from "bun:test";

import { Serializer } from "../dist";

let exampleMsg = {
  join_ref: "0",
  ref: "1",
  topic: "t",
  event: "e",
  payload: { foo: 1 },
};

let binPayload = () => {
  let buffer = new ArrayBuffer(1);
  new DataView(buffer).setUint8(0, 1);
  return buffer;
};

describe("JSON", function () {
  it("encodes general pushes", function () {
    Serializer.encode(exampleMsg, (result) => {
      expect(result).toEqual('["0","1","t","e",{"foo":1}]');
    });
  });

  it("decodes", function () {
    Serializer.decode('["0","1","t","e",{"foo":1}]', (result) => {
      expect(result).toStrictEqual(exampleMsg);
    });
  });
});

describe("binary", function () {
  it("encodes", function () {
    let buffer = binPayload();
    let bin = "\0\x01\x01\x01\x0101te\x01";
    let decoder = new TextDecoder();
    Serializer.encode(
      { join_ref: "0", ref: "1", topic: "t", event: "e", payload: buffer },
      (result) => {
        expect(decoder.decode(result)).toEqual(bin);
      },
    );
  });

  it("encodes variable length segments", function () {
    let buffer = binPayload();
    let bin = "\0\x02\x01\x03\x02101topev\x01";
    let decoder = new TextDecoder();
    Serializer.encode(
      { join_ref: "10", ref: "1", topic: "top", event: "ev", payload: buffer },
      (result) => {
        expect(decoder.decode(result)).toEqual(bin);
      },
    );
  });

  it("decodes push", function () {
    let bin = "\0\x03\x03\n123topsome-event\x01\x01";
    let buffer = new TextEncoder().encode(bin).buffer;
    let decoder = new TextDecoder();
    Serializer.decode(buffer, (result) => {
      expect(result.join_ref).toEqual("123");
      expect(result.ref).toEqual(null);
      expect(result.topic).toEqual("top");
      expect(result.event).toEqual("some-event");
      expect(result.payload.constructor).toEqual(ArrayBuffer);
      expect(decoder.decode(result.payload)).toEqual("\x01\x01");
    });
  });

  it("decodes reply", function () {
    let bin = "\x01\x03\x02\x03\x0210012topok\x01\x01";
    let buffer = new TextEncoder().encode(bin).buffer;
    let decoder = new TextDecoder();
    Serializer.decode(buffer, (result) => {
      expect(result.join_ref).toEqual("100");
      expect(result.ref).toEqual("12");
      expect(result.topic).toEqual("top");
      expect(result.event).toEqual("phx_reply");
      expect(result.payload.status).toEqual("ok");
      expect(result.payload.response.constructor).toEqual(ArrayBuffer);
      expect(decoder.decode(result.payload.response)).toEqual("\x01\x01");
    });
  });

  it("decodes broadcast", function () {
    let bin = "\x02\x03\ntopsome-event\x01\x01";
    let buffer = new TextEncoder().encode(bin).buffer;
    let decoder = new TextDecoder();
    Serializer.decode(buffer, (result) => {
      expect(result.join_ref).toEqual(null);
      expect(result.ref).toEqual(null);
      expect(result.topic).toEqual("top");
      expect(result.event).toEqual("some-event");
      expect(result.payload.constructor).toEqual(ArrayBuffer);
      expect(decoder.decode(result.payload)).toEqual("\x01\x01");
    });
  });
});
