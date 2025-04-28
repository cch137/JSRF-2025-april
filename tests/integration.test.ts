import WebSocket from "ws";
import { JSRFServer } from "../src/server";
import { JSRFClient } from "../src/client";
import { Packet } from "../src/packet";
import { ServiceType, Opcode } from "../src/types";

const PORT = 8081;

describe("JSRF Client-Server Integration", () => {
  let server: JSRFServer;

  beforeAll(() => {
    server = new JSRFServer(PORT);
  });

  afterAll(() => {
    server.close();
  });

  test("should handle function calls with multiple and complex parameters", async () => {
    jest.setTimeout(10000);
    const client = new JSRFClient(`ws://localhost:${PORT}`);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const channelId = await client.registerService(
      "function-service",
      ServiceType.JSON_SYNCHRONIZATION
    );

    let receivedPayload: any = null;
    server.registerService(channelId, async (packet) => {
      receivedPayload = packet.payload;
      // Simulate function execution on server side
      if (packet.payload.functionName === "complexFunction") {
        const result = {
          status: "success",
          result:
            packet.payload.params.param1 + packet.payload.params.param2.value,
        };
        const responsePacket = new Packet(
          {
            hasAck: true,
            opcode: Opcode.EMPTY,
            channel: channelId,
            seq: 2,
            ack: packet.headers.seq,
          },
          result
        );
        server["wss"].clients.forEach((ws: any) => {
          ws.send(Packet.encode(responsePacket));
        });
      }
    });

    const complexParams = {
      functionName: "complexFunction",
      params: {
        param1: 10,
        param2: { value: 20, type: "number" },
        param3: { nested: { key: "value" } },
      },
    };
    const packet = new Packet(
      { hasAck: false, opcode: Opcode.EMPTY, channel: channelId, seq: 1 },
      complexParams
    );
    client["ws"].send(Packet.encode(packet));

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(receivedPayload).toEqual(complexParams);
  });

  test("should establish channel and exchange JSON payload between client and server", async () => {
    jest.setTimeout(10000);
    const client = new JSRFClient(`ws://localhost:${PORT}`);
    // allow connection setup
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Client registers a JSON synchronization service
    const channelId = await client.registerService(
      "test-service",
      ServiceType.JSON_SYNCHRONIZATION
    );

    // Server sets a handler for that channel
    let receivedPayload: any = null;
    server.registerService(channelId, async (packet) => {
      receivedPayload = packet.payload;
    });

    // Client sends a complex nested object to server
    const complexPayload = {
      level1: {
        text: "hello",
        array: [1, 2, { nested: true }],
        deep: { a: { b: { c: "value" } } },
      },
    };
    const packet = new Packet(
      { hasAck: false, opcode: Opcode.EMPTY, channel: channelId, seq: 1 },
      complexPayload
    );
    client["ws"].send(Packet.encode(packet));

    // allow message delivery
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(receivedPayload).toEqual(complexPayload);
  });

  test("should handle multiple clients independently", async () => {
    jest.setTimeout(10000);
    const client1 = new JSRFClient(`ws://localhost:${PORT}`);
    const client2 = new JSRFClient(`ws://localhost:${PORT}`);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const ch1 = await client1.registerService(
      "svc1",
      ServiceType.JSON_SYNCHRONIZATION
    );
    const ch2 = await client2.registerService(
      "svc2",
      ServiceType.JSON_SYNCHRONIZATION
    );

    let rec1: any = null;
    let rec2: any = null;
    server.registerService(ch1, async (packet) => {
      rec1 = packet.payload;
    });
    server.registerService(ch2, async (packet) => {
      rec2 = packet.payload;
    });

    const payload1 = { num: 42 };
    const payload2 = { flag: false };
    client1["ws"].send(
      Packet.encode(
        new Packet(
          { hasAck: false, opcode: Opcode.EMPTY, channel: ch1, seq: 1 },
          payload1
        )
      )
    );
    client2["ws"].send(
      Packet.encode(
        new Packet(
          { hasAck: false, opcode: Opcode.EMPTY, channel: ch2, seq: 1 },
          payload2
        )
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(rec1).toEqual(payload1);
    expect(rec2).toEqual(payload2);
  });

  test("should handle synchronous complex structure objects", async () => {
    jest.setTimeout(10000);
    const client = new JSRFClient(`ws://localhost:${PORT}`);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const channelId = await client.registerService(
      "complex-structure-service",
      ServiceType.JSON_SYNCHRONIZATION
    );

    let receivedPayload: any = null;
    server.registerService(channelId, async (packet) => {
      receivedPayload = packet.payload;
    });

    const complexStructure = {
      id: 123,
      name: "Test Object",
      details: {
        nested1: {
          nested2: {
            nested3: "deep value",
            array: [1, 2, { inner: "object" }],
          },
        },
        metadata: {
          timestamp: Date.now(),
          tags: ["test", "complex", { key: "value" }],
        },
      },
    };
    const packet = new Packet(
      { hasAck: false, opcode: Opcode.EMPTY, channel: channelId, seq: 1 },
      complexStructure
    );
    client["ws"].send(Packet.encode(packet));

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(receivedPayload).toEqual(complexStructure);
  });

  test("should handle function calls with multiple complex parameters", async () => {
    jest.setTimeout(10000);
    const client = new JSRFClient(`ws://localhost:${PORT}`);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const channelId = await client.registerService(
      "complex-function-service",
      ServiceType.JSON_SYNCHRONIZATION
    );

    let receivedPayload: any = null;
    server.registerService(channelId, async (packet) => {
      receivedPayload = packet.payload;
      // Simulate function execution on server side
      if (packet.payload.functionName === "complexFunctionCall") {
        const result = {
          status: "success",
          result:
            packet.payload.params.param1.value +
            packet.payload.params.param2.value,
          processed: packet.payload.params.param3.data.map(
            (item: any) => item * 2
          ),
        };
        const responsePacket = new Packet(
          {
            hasAck: true,
            opcode: Opcode.EMPTY,
            channel: channelId,
            seq: 2,
            ack: packet.headers.seq,
          },
          result
        );
        server["wss"].clients.forEach((ws: any) => {
          ws.send(Packet.encode(responsePacket));
        });
      }
    });

    const complexFunctionCall = {
      functionName: "complexFunctionCall",
      params: {
        param1: { value: 10, type: "number" },
        param2: { value: 20, type: "number" },
        param3: { data: [1, 2, 3, 4], type: "array" },
        param4: {
          nested: {
            key1: "value1",
            key2: { inner: "deep" },
            key3: [5, 6, 7],
          },
        },
      },
    };
    const packet = new Packet(
      { hasAck: false, opcode: Opcode.EMPTY, channel: channelId, seq: 1 },
      complexFunctionCall
    );
    client["ws"].send(Packet.encode(packet));

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(receivedPayload).toEqual(complexFunctionCall);
  });
});
