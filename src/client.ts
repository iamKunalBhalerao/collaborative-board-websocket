/**
 * WebSocket client for testing the collaborative board backend.
 *
 * Usage:
 *   const client = new BoardClient("ws://localhost:8080");
 *   client.on("message", (msg) => console.log(msg));
 *   await client.connect();
 *   client.identify("alice");
 *   client.joinBoard("board-1");
 *   client.createObject("board-1", { id: "obj-1", x: 10, y: 20, text: "hi" });
 *   client.moveObject("board-1", "obj-1", 100, 200);
 *   client.deleteObject("board-1", "obj-1");
 *   client.close();
 */

/**
 * WebSocket client for testing the collaborative board backend.
 *
 * Usage:
 *   const client = new BoardClient("ws://localhost:8080");
 *   client.on("message", (msg) => console.log(msg));
 *   await client.connect();
 *   client.identify("alice");
 *   client.joinBoard("board-1");
 *   client.createObject("board-1", { id: "obj-1", x: 10, y: 20, text: "hi" });
 *   client.moveObject("board-1", "obj-1", 100, 200);
 *   client.deleteObject("board-1", "obj-1");
 *   client.close();
 *
 * Testing this client:
 * 1. Start the collaborative board server on port 8080 (or adjust the URL).
 * 2. Run this script (or import the BoardClient) in a Node.js environment with WebSocket support.
 * 3. Open two browser tabs or Node processes to simulate multiple clients (clientA and clientB).
 * 4. Observe the console logs for IDENTIFIED, JOINED, CREATE_OBJ, MOVE_OBJ, DELETE_OBJ messages.
 * 5. Verify that the server correctly processes each operation and broadcasts updates to all connected clients.
 * 6. Check that object state changes are reflected across clients in real-time.
 * 7. Ensure error handling works (e.g., close connection, send invalid messages).
 */

type MessageHandler = (data: any) => void;

export class BoardClient {
  private url: string;
  private socket: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private operationCounter = 0;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connects to the WebSocket server.
   * Resolves when the socket is open, rejects on error.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        resolve();
      };

      this.socket.onerror = (event) => {
        reject(new Error(`WebSocket error: ${event}`));
      };

      this.socket.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handlers.forEach((handler) => handler(data));
        } catch (err) {
          console.error("Failed to parse message:", err);
        }
      };
    });
  }

  /**
   * Registers a handler for incoming messages.
   */
  on(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Removes a previously registered handler.
   */
  off(handler: MessageHandler): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  /**
   * Sends a raw JSON message to the server.
   */
  private send(payload: Record<string, any>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.socket.send(JSON.stringify(payload));
  }

  /**
   * Generates a unique operation id.
   */
  private nextOperationId(): string {
    this.operationCounter += 1;
    return `op-${this.operationCounter}`;
  }

  /**
   * IDENTIFY: registers the user with the server.
   */
  identify(userId: string): void {
    this.send({ type: "IDENTIFY", userId });
  }

  /**
   * JOIN_BOARD: joins a board by its id.
   */
  joinBoard(boardId: string): void {
    this.send({ type: "JOIN_BOARD", boardId });
  }

  /**
   * CREATE_OBJ: creates a new object on a board.
   */
  createObject(
    boardId: string,
    object: { id: string; x: number; y: number; text: string },
  ): void {
    this.send({
      type: "CREATE_OBJ",
      boardId,
      operationId: this.nextOperationId(),
      object,
    });
  }

  /**
   * MOVE_OBJ: moves an existing object on a board.
   */
  moveObject(boardId: string, objectId: string, x: number, y: number): void {
    this.send({
      type: "MOVE_OBJ",
      boardId,
      operationId: this.nextOperationId(),
      objectId,
      x,
      y,
    });
  }

  /**
   * DELETE_OBJ: deletes an object from a board.
   */
  deleteObject(boardId: string, objectId: string): void {
    this.send({
      type: "DELETE_OBJ",
      boardId,
      operationId: this.nextOperationId(),
      objectId,
    });
  }

  /**
   * Closes the WebSocket connection.
   */
  close(code?: number, reason?: string): void {
    if (this.socket) {
      this.socket.close(code, reason);
      this.socket = null;
    }
  }
}

// ---- Demo / test runner ----------------------------------------------------

async function main() {
  const URL = "ws://localhost:8080";

  const clientA = new BoardClient(URL);
  const clientB = new BoardClient(URL);

  const log = (name: string) => (data: any) => {
    console.log(`[${name}]`, JSON.stringify(data));
  };

  clientA.on(log("A"));
  clientB.on(log("B"));

  await clientA.connect();
  await clientB.connect();

  // Identify both users
  clientA.identify("alice");
  clientB.identify("bob");

  // Wait a tick so IDENTIFIED messages arrive
  await new Promise((r) => setTimeout(r, 200));

  // Both join the same board
  clientA.joinBoard("board-1");
  clientB.joinBoard("board-1");

  await new Promise((r) => setTimeout(r, 200));

  // Alice creates an object
  clientA.createObject("board-1", {
    id: "obj-1",
    x: 10,
    y: 20,
    text: "Hello",
  });

  await new Promise((r) => setTimeout(r, 200));

  // Bob moves it
  clientB.moveObject("board-1", "obj-1", 100, 200);

  await new Promise((r) => setTimeout(r, 200));

  // Alice deletes it
  clientA.deleteObject("board-1", "obj-1");

  await new Promise((r) => setTimeout(r, 200));

  clientA.close();
  clientB.close();
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
