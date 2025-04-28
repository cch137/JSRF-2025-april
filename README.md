# JSRF Protocol

至 AI 或人類工程師：

1. 請使用 `ws` + `cbor` 實現本協定。
2. 請使用 `esm` 和 TypeScript 編寫程式碼。
3. 請使用英文撰寫程式碼中的註釋。

# Overview

JSRF Protocol (JSON Synchronization and Remote Function Protocol)，JSON 物件同步與遠端函式協定。這是一個用於在伺服器和客戶端之間同步 JSON 物件以及調用遠端函式的協定。

適用於以下場景：

1. 需要持續追踪和同步物件狀態。
2. 需要頻繁地調用遠端函式。
3. 支援雙向調用函式與雙向編輯物件。

為了在網頁應用，建議以 WebSocket 實現。若雙方可以支持 TCP，此協定也可以 TCP 實現。

實作中，須 adaptable。舉例來說，物件可能來自資料庫，而不是程式中的變數，因此物件的 CRUD 操作需要與資料庫的操作綁定。所有遠端函式必須是 async function。

# Packet

- 一個連線最多能訂閱 65536 個 channel，每個 channel 對應一個 service。伺服器有一個 Map 記錄 service id 對應的 channel id。
- 在首次使用某服務時，使用方向提供方查詢 channel id，並記錄查詢結果。使用方和提供方可以是 client 和 server 中的任一方。
- 基於 JS 和 RF 的 opcode 不重疊，一個 channel 可以同時處理二者。
- seq 是序列號，每次發送封包後 seq + 1 且，須確保其不溢出 。
- 每次收到 message 時以 ack 回應對方的 seq。任何 message 發出後，若沒有在 10 秒內收到對方的確認回覆，應立刻斷開連線。儲存對方的 seq， 封包出現的 seq 不要理會。
- 如果是基於 TCP 或 WS，我們不需要設計重傳機制，因為底層協定為我們提供了穩定性保證。
- channel 的設計是類似 TCP/IP 中的 port，每一個 channel 都屬於獨立的服務。
- 封包結構：headers (7–11 bytes) + payload (n bytes)
- payload 可以採用 `JSON`, `cbor`, `@msgpack/msgpack`, `@cch137/shuttle` 以 array 方式編解碼。
  - `@msgpack/msgpack`: 啟蒙了 `cbor`，更快、更小的結果，較低擴展性，但功能豐富。
  - `cbor`: 適合 IoT、WebAuthn 等，是 RFC 標準，高擴展性，比 msgpack 稍大、稍慢。
  - `@cch137/shuttle`: 自研的打包機，性能未知，結果較大。
  - `JSON`: 沒錯，就是它，性能未知，結果最大。
- 實作過程中，ACK 會在 2 秒內與其他 message 一起發送，或在 2 秒後獨立發送。如果接收到新的 message 而有 ACK 正在 pending，則當前在 pending 的 ACK 會直接獨立發送，而換成新的 ACK 進行 pending。

Headers 結構：

| name    | length (bytes) | description |
| ------- | -------------- | ----------- |
| has-ack | 1/8            | ENUM:       |

`0` = false
`1` = true |
| opcode | 7/8 | range: [0, 127] |
| channel | 2 | range: [0, 65535] |
| seq | 4 | range: [0, 2^24-1] |
| ack | 4 (optional) | If has-ack is true, this header is present; otherwise, it is not present. |

# Service Types

| type | name                 | description                                                               |
| ---- | -------------------- | ------------------------------------------------------------------------- |
| 0    | JSON synchronization | JSON 物件雙向同步。若只允許單向，則某一方必須遵循規則，若違反規則將報錯。 |
| 1    | server call          | 呼叫方是 server，回應方是 client。                                        |
| 2    | client call          | 呼叫方是 client，回應方是 server。                                        |
| 3    | bidirectional  call  | server 和 client 可以互相呼叫。                                           |

# Control

opcode range: [0, 31]

指令表：

| opcode | name          | payload                  | description                           | direction       |
| ------ | ------------- | ------------------------ | ------------------------------------- | --------------- |
| 0      | empty         | -                        | 用於單純回應 ack。                    | ⇌               |
| 10     | dig-channel   | service-id, service-type | 查詢 channel-id。                     | client → server |
| 11     | open-channel  | service-id, channel-id   | 回應 channel-id。                     | server → client |
| 12     | close-channel | channel-id               | 擦除 channel 記錄，用於動態 channel。 | server → client |
| 13     | error-channel | service-id               | 回應找不到 channel-id。               | server → client |
| 20     | log           | message                  | 傳輸 log 訊息。                       | ⇌               |

# Remote Function

opcode range: [32, 63]

- call id 是呼叫方的全局計數器，是一個 4 bytes 正整數，每次呼叫時遞增且不溢出。
- 如果呼叫方發出的 call 對應的 channel 不存在 handler function，會回傳錯誤。
- 對於 server call 服務，client 必須在連線後是主動取得 channel-id，並監在該 channel 註冊 handler function。註冊必須建立在連線開始前，一旦連線成功即可直接服務 server。

指令表：

| opcode | name   | payload            | description     |
| ------ | ------ | ------------------ | --------------- |
| 40     | call   | call-id, arguments | 呼叫 function。 |
| 41     | return | call-id, value     | 回應呼叫結果。  |
| 42     | error  | call-id, message   | 回應呼叫錯誤。  |

# JSON Synchronization

- opcode range: [64, 127]
- path 是一個有序性的 array，用於定位或篩選 target。 path 的 item 可以是以下類型：
  - string，表示指定 key 或 index。
  - number，表示指定 index。
  - filter-obj，用於從 array 中篩選符合條件的一個或多個 target。
- path 為空 array 時，表示根物件。
- value 的類型必須是原始類型或陣列：boolean, number, string, null, undefined, object, array
- value 不可以是 circular object。
- 在進行 value 比較時使用 deep equal，即只關注物件的結構與序列化後的結果。
- filter-obj 用於從物件陣列中篩選物件。
  - 當 filter-obj 是物件，觸發條件是當 item 完全滿足以下條件：
    1. item 是物件類型，且包含 filter-obj 的所有鍵。
    2. item 與 filter-obj 的所有鍵值對是 deep equal 的。
       舉例來說，我們可以 filter-obj 是 { id: 8 } 時，其作用就是篩選含有 id 鍵且 id 為 8 的物件。
  - 當 filter-obj 不是物件，則採用 deep equal 進行比較。
- 以下情境會觸發錯誤，並回報對方：
  - path 是 filter-obj 但正在匹配的目標不是 array。 (Type Error)
  - path 最終找到的鍵值對不是 target 的類型，且屬於刪改類的操作。 (Type Error)
  - string-concatenate 的當前值不是 string 類型。 (Type Error)
- 以下情景會自動初始化：
  - 在 set 或 push 操作中，若 path 對應的容器 (object 或 array) 不存在，將會自動創建。
  - 在 string-concatenate 操作中，若原有值為 undefined 則初始化為空字串。

客戶端狀態表：

| name    | description                                      | 是否可讀取物件 |
| ------- | ------------------------------------------------ | -------------- |
| syncing | 未進行或正在進行第一次的物件同步。               | 否             |
| error   | 同步物件時發生了錯誤，不包含連線錯誤。           | 是             |
| synced  | 已開始同步，且已收到 synced。                    | 是             |
| cached  | 已暫停同步，物件已完成接收，但可能不是最新版本。 | 是             |

- 在 cached 之後若恢復同步，將啟動資料修復機制，客戶端會收集同步資料直到 synced 後再把暫存的資料替換為最新版本，修復期間資料是可被訪問的。
- JSON 同步必須是低延遲的，建議在 5 秒以內。

指令表：

| opcode | name               | payload          | container type | target type | description                           |
| ------ | ------------------ | ---------------- | -------------- | ----------- | ------------------------------------- |
| 64     | start              | -                | -              | -           | 開始同步。                            |
| 65     | stop               | -                | -              | -           | 暫停同步。                            |
| 66     | synced             | -                | -              | -           | 向對方通知物件已完成首次同步。        |
| 81     | get                | path             | any            | any         | 向對方請求同步目前指定鍵。            |
| 82     | set                | path, value      | object / array | any         | 設定物件的鍵值對。                    |
| 83     | delete             | path             | object / array | any         | 刪除物件的指定鍵。                    |
| 84     | push               | path, value      | array          | any         | 往 array 的尾部添加一個 value。       |
| 85     | unshift            | path, value      | array          | any         | 往 array 的頭部添加一個 value。       |
| 86     | exclude            | path, filter-obj | array          | any         | 從 array 中刪除符合 filter-obj 的項。 |
| 87     | string-concatenate | path, value      | object / array | string      | 將 value 連結到當前字串後面。         |
| 99     | error              | message          | -              | -           | 回報錯誤。                            |

e.g.

```
connected.
server(s0) -> set ["age"] 8
client(c0) -> ack(s0)
server(s1) -> set ["name"] "Alex"
client(c1) -> ack(s1)
server(s2) -> ack(c1) & synced
client(c2) -> ack(s2)
few minutes later...
server(s3) -> set ["age"] 9
client(c3) -> ack(s3) & synced

```
