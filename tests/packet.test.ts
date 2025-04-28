import { Packet, PacketHeaders } from "../src/packet";
import { Opcode } from "../src/types";

describe("Packet", () => {
  test("should encode and decode a packet without ack", () => {
    const headers: PacketHeaders = {
      hasAck: false,
      opcode: Opcode.EMPTY,
      channel: 1,
      seq: 100,
    };
    const payload = { message: "test" };
    const packet = new Packet(headers, payload);
    const encoded = Packet.encode(packet);
    const decoded = Packet.decode(encoded);

    expect(decoded.headers).toEqual(headers);
    expect(decoded.payload).toEqual(payload);
  });

  test("should encode and decode a packet with ack", () => {
    const headers: PacketHeaders = {
      hasAck: true,
      opcode: Opcode.DIG_CHANNEL,
      channel: 2,
      seq: 200,
      ack: 150,
    };
    const payload = { id: "service1", type: 1 };
    const packet = new Packet(headers, payload);
    const encoded = Packet.encode(packet);
    const decoded = Packet.decode(encoded);

    expect(decoded.headers).toEqual(headers);
    expect(decoded.payload).toEqual(payload);
  });

  test("should handle empty payload", () => {
    const headers: PacketHeaders = {
      hasAck: false,
      opcode: Opcode.OPEN_CHANNEL,
      channel: 0,
      seq: 300,
    };
    const packet = new Packet(headers);
    const encoded = Packet.encode(packet);
    const decoded = Packet.decode(encoded);

    expect(decoded.headers).toEqual(headers);
    expect(decoded.payload).toBeNull();
  });
});
