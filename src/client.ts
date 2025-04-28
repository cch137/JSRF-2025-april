interface WebSocketInterface {
  send(data: any): void;
  addEventListener(event: string, callback: (data: any) => void): void;
  readyState: number;
  close(): void;
}

declare const WebSocket: {
  new (url: string): WebSocketInterface;
  CONNECTING: 0;
  OPEN: 1;
  CLOSING: 2;
  CLOSED: 3;
};

// Polyfill Buffer if not available in browser environment
declare const Buffer: any;
declare const globalThis: any;

if (
  typeof Buffer === "undefined" &&
  typeof globalThis !== "undefined" &&
  "window" in globalThis
) {
  (globalThis as any).Buffer = {
    from: function (data: any) {
      if (typeof data === "string") {
        const arr = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          arr[i] = data.charCodeAt(i);
        }
        return arr;
      }
      return new Uint8Array(data);
    },
    alloc: function (size: number) {
      return new Uint8Array(size);
    },
  };
}
import { Packet, PacketHeaders } from "./packet";
import { ServiceType, Opcode } from "./types";

export class JSRFClient {
  private ws: WebSocketInterface;
  private services: Map<
    number,
    {
      id: string;
      type: ServiceType;
      handler?: (packet: Packet) => Promise<void>;
    }
  > = new Map();
  private channelMap: Map<string, number> = new Map();
  private seq: number = 0;
  private pendingAcks: Map<number, number> = new Map();
  private lastAck: number = 0;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.setupClient();
  }

  private setupClient(): void {
    this.ws.addEventListener("open", () => {
      console.log("Connected to JSRF server");
    });
    this.ws.addEventListener("message", async (data: any) => {
      await this.handleMessage(data);
    });
    this.ws.addEventListener("close", () => {
      console.log("Disconnected from JSRF server");
    });
  }

  private async handleMessage(data: any): Promise<void> {
    let bufferData = data;
    if (data instanceof MessageEvent) {
      bufferData = data.data;
    }
    if (bufferData instanceof Blob) {
      bufferData = await bufferData.arrayBuffer();
    }
    const buffer = Buffer.from(bufferData as ArrayBuffer);
    const packet = Packet.decode(buffer);
    this.lastAck = packet.headers.seq;

    if (packet.headers.hasAck && packet.headers.ack !== undefined) {
      this.pendingAcks.delete(packet.headers.ack);
    }

    // Handle ACK
    if (this.pendingAcks.has(packet.headers.seq)) {
      this.sendAck(packet.headers.seq);
    } else {
      this.pendingAcks.set(packet.headers.seq, Date.now());
      setTimeout(() => {
        if (this.pendingAcks.has(packet.headers.seq)) {
          this.sendAck(packet.headers.seq);
          this.pendingAcks.delete(packet.headers.seq);
        }
      }, 2000);
    }

    // Process packet based on opcode
    await this.processPacket(packet);
  }

  private sendAck(seq: number): void {
    const headers: PacketHeaders = {
      hasAck: false,
      opcode: Opcode.EMPTY,
      channel: 0,
      seq: this.seq++,
    };
    const ackPacket = new Packet(headers);
    this.ws.send(Packet.encode(ackPacket));
  }

  private async processPacket(packet: Packet): Promise<void> {
    const service = this.services.get(packet.headers.channel);
    if (service) {
      if (service.handler) {
        await service.handler(packet);
      }
    } else if (packet.headers.opcode === Opcode.OPEN_CHANNEL) {
      const { id, channelId } = packet.payload;
      this.channelMap.set(id, channelId);
      this.services.set(channelId, {
        id,
        type: ServiceType.JSON_SYNCHRONIZATION,
      });
    }
  }

  public async registerService(
    serviceId: string,
    type: ServiceType,
    handler?: (packet: Packet) => Promise<void>
  ): Promise<number> {
    const channelId = await this.digChannel(serviceId, type);
    this.services.set(channelId, { id: serviceId, type, handler });
    return channelId;
  }

  private async digChannel(
    serviceId: string,
    type: ServiceType
  ): Promise<number> {
    return new Promise<number>((resolve) => {
      const headers: PacketHeaders = {
        hasAck: false,
        opcode: Opcode.DIG_CHANNEL,
        channel: 0,
        seq: this.seq++,
      };
      const packet = new Packet(headers, { id: serviceId, type });
      this.ws.send(Packet.encode(packet));

      const checkChannel = setInterval(() => {
        const channelId = this.channelMap.get(serviceId);
        if (channelId) {
          clearInterval(checkChannel);
          resolve(channelId);
        }
      }, 100);
    });
  }
}
