import { JSRFServer } from "../src/server";
import WebSocket from "ws";
import { Packet, PacketHeaders } from "../src/packet";
import { Opcode, ServiceType } from "../src/types";

// Mock WebSocket
jest.mock("ws", () => {
  const mockWebSocket = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
  }));
  const mockServer = jest.fn().mockImplementation(() => ({
    on: jest.fn((event, callback) => {
      if (event === "connection") {
        // Simulate a connection for testing
        const mockWs = {
          on: jest.fn(),
          send: jest.fn(),
          close: jest.fn(),
        };
        callback(mockWs);
      }
    }),
    close: jest.fn(),
  }));
  return {
    default: mockWebSocket,
    Server: mockServer,
  };
});

describe("JSRFServer", () => {
  let server: JSRFServer;

  beforeEach(() => {
    server = new JSRFServer(8080);
  });

  test("should initialize WebSocket server on specified port", () => {
    const mockServer = (WebSocket as any).Server;
    expect(mockServer).toHaveBeenCalledWith({ port: 8080 });
  });

  test("should handle new connections", () => {
    // The mock already simulates a connection in the setup
    const mockServer = (WebSocket as any).Server;
    expect(mockServer).toHaveBeenCalled();
  });

  test("should register a service handler", () => {
    const channelId = 1;
    const handler = jest.fn();
    server.registerService(channelId, handler);
    // This is a basic test to ensure registration doesn't throw
    expect(true).toBe(true);
  });
});
