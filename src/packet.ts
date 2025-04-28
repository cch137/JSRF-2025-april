import { Opcode } from "./types";

export interface PacketHeaders {
  hasAck: boolean;
  opcode: Opcode;
  channel: number;
  seq: number;
  ack?: number;
}

export class Packet {
  headers: PacketHeaders;
  payload: any;

  constructor(headers: PacketHeaders, payload: any = null) {
    this.headers = headers;
    this.payload = payload;
  }

  static encode(packet: Packet): Buffer {
    const headers = packet.headers;
    const buffer = Buffer.alloc(7 + (headers.hasAck ? 4 : 0));
    let offset = 0;

    // Write has-ack (1 bit) and opcode (7 bits) into the first byte
    buffer.writeUInt8(
      ((headers.hasAck ? 1 : 0) << 7) | (headers.opcode & 0x7f),
      offset++
    );
    // Write channel (2 bytes)
    buffer.writeUInt16BE(headers.channel, offset);
    offset += 2;
    // Write seq (4 bytes)
    buffer.writeUInt32BE(headers.seq, offset);
    offset += 4;
    // Write ack if present (4 bytes)
    if (headers.hasAck && headers.ack !== undefined) {
      buffer.writeUInt32BE(headers.ack, offset);
    }

    const cbor = require("cbor");
    const payloadBuffer = cbor.encode(packet.payload);

    return Buffer.concat([buffer, payloadBuffer]);
  }

  static decode(buffer: Buffer): Packet {
    let offset = 0;
    const firstByte = buffer.readUInt8(offset++);
    const hasAck = firstByte >> 7 === 1;
    const opcode = firstByte & 0x7f;
    const channel = buffer.readUInt16BE(offset);
    offset += 2;
    const seq = buffer.readUInt32BE(offset);
    offset += 4;
    let ack: number | undefined;
    if (hasAck) {
      ack = buffer.readUInt32BE(offset);
      offset += 4;
    }

    const payloadBuffer = buffer.slice(offset);
    const cbor = require("cbor");
    const payload = cbor.decode(payloadBuffer);

    return new Packet(
      {
        hasAck,
        opcode: opcode as Opcode,
        channel,
        seq,
        ack,
      },
      payload
    );
  }
}
