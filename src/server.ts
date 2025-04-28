import WebSocket from "ws";
import { Packet, PacketHeaders } from "./packet";
import { ServiceType, Opcode } from "./types";

export class JSRFServer {
  private wss: WebSocket.Server;
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
  private clients: Map<WebSocket, { seq: number; lastAck: number }> = new Map();

  constructor(port: number) {
    this.wss = new WebSocket.Server({ port });
    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      this.clients.set(ws, { seq: 0, lastAck: 0 });
      ws.on("message", async (data: WebSocket.Data) => {
        await this.handleMessage(ws, data);
      });
      ws.on("close", () => {
        this.clients.delete(ws);
      });
    });
  }

  private async handleMessage(
    ws: WebSocket,
    data: WebSocket.Data
  ): Promise<void> {
    const buffer = Buffer.from(data as ArrayBuffer);
    const packet = Packet.decode(buffer);
    const clientInfo = this.clients.get(ws);

    if (clientInfo) {
      clientInfo.lastAck = packet.headers.seq;
      if (packet.headers.hasAck && packet.headers.ack !== undefined) {
        this.pendingAcks.delete(packet.headers.ack);
      }

      // Handle ACK
      if (this.pendingAcks.has(packet.headers.seq)) {
        this.sendAck(ws, packet.headers.seq);
      } else {
        this.pendingAcks.set(packet.headers.seq, Date.now());
        setTimeout(() => {
          if (this.pendingAcks.has(packet.headers.seq)) {
            this.sendAck(ws, packet.headers.seq);
            this.pendingAcks.delete(packet.headers.seq);
          }
        }, 2000);
      }

      // Process packet based on opcode
      await this.processPacket(ws, packet);
    }
  }

  private sendAck(ws: WebSocket, seq: number): void {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      const headers: PacketHeaders = {
        hasAck: false,
        opcode: Opcode.EMPTY,
        channel: 0,
        seq: clientInfo.seq++,
      };
      const ackPacket = new Packet(headers);
      ws.send(Packet.encode(ackPacket));
    }
  }

  private async processPacket(ws: WebSocket, packet: Packet): Promise<void> {
    const service = this.services.get(packet.headers.channel);
    if (service) {
      if (service.handler) {
        await service.handler(packet);
      }
    } else if (packet.headers.opcode === Opcode.DIG_CHANNEL) {
      const { id, type } = packet.payload;
      let channelId = this.channelMap.get(id);
      if (!channelId) {
        channelId = this.assignChannel(id, type);
      }
      const responseHeaders: PacketHeaders = {
        hasAck: true,
        opcode: Opcode.OPEN_CHANNEL,
        channel: 0,
        seq: this.seq++,
        ack: packet.headers.seq,
      };
      const responsePacket = new Packet(responseHeaders, { id, channelId });
      ws.send(Packet.encode(responsePacket));
    }
  }

  private assignChannel(serviceId: string, type: ServiceType): number {
    const channelId = this.services.size + 1;
    this.services.set(channelId, { id: serviceId, type });
    this.channelMap.set(serviceId, channelId);
    return channelId;
  }

  public registerService(
    channelId: number,
    handler: (packet: Packet) => Promise<void>
  ): void {
    const service = this.services.get(channelId);
    if (service) {
      service.handler = handler;
    }
  }

  public close(): void {
    this.wss.close();
  }
}
