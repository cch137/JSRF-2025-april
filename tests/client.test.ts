import { JSRFClient } from "../src/client";
import WebSocket from "ws";
import { Packet, PacketHeaders } from "../src/packet";
import { Opcode, ServiceType } from "../src/types";

// Mock WebSocket
jest.mock("ws", () => {
  const mockWebSocket = jest.fn().mockImplementation(() => ({
    on: jest.fn((event, callback) => {
      if (event === "open") {
        callback();
      }
    }),
    send: jest.fn(),
    close: jest.fn(),
  }));
  return mockWebSocket;
});

describe("JSRFClient", () => {
  let client: JSRFClient;

  beforeEach(() => {
    client = new JSRFClient("ws://localhost:8080");
  });

  test("should initialize WebSocket connection", () => {
    expect(WebSocket).toHaveBeenCalledWith("ws://localhost:8080");
  });

  test("should handle connection open", () => {
    // The mock already simulates an open event
    expect(WebSocket).toHaveBeenCalled();
  });
});
