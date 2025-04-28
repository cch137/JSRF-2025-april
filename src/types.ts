export enum ServiceType {
  JSON_SYNCHRONIZATION = 0,
  SERVER_CALL = 1,
  CLIENT_CALL = 2,
  BIDIRECTIONAL_CALL = 3,
}

export enum Opcode {
  // Control opcodes [0, 31]
  EMPTY = 0,
  DIG_CHANNEL = 10,
  OPEN_CHANNEL = 11,
  CLOSE_CHANNEL = 12,
  ERROR_CHANNEL = 13,
  LOG = 20,

  // Remote Function opcodes [32, 63]
  CALL = 40,
  RETURN = 41,
  ERROR = 42,

  // JSON Synchronization opcodes [64, 127]
  START = 64,
  STOP = 65,
  SYNCED = 66,
  GET = 81,
  SET = 82,
  DELETE = 83,
  PUSH = 84,
  UNSHIFT = 85,
  EXCLUDE = 86,
  STRING_CONCATENATE = 87,
  ERROR_SYNC = 99,
}

export interface FilterObject {
  [key: string]: any;
}

export type PathItem = string | number | FilterObject;

export interface Path {
  items: PathItem[];
}
