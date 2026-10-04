import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

type BoardObject = {
  id: string;
  x: number;
  y: number;
  text: string;
};

interface Board {
  users: Set<WebSocket>;
  objects: Map<string, BoardObject>;
  sequenceNumber: number;
}

const boards = new Map<string, Board>();
const users = new Map<string, WebSocket>();

wss.on("connection", (socket) => {
  let currentUser: string | null = null;

  socket.on("message", (data) => {
    const message = data.toString();
    let parsedData;
    try {
      parsedData = JSON.parse(message);
      if (typeof parsedData === "object" && parsedData !== null) {
        //

        if (parsedData.type === "IDENTIFY") {
          if (!parsedData.userId)
            return socket.send(
              JSON.stringify({ type: "ERROR", message: "userId is required" }),
            );

          if (currentUser)
            return socket.send(
              JSON.stringify({ type: "ERROR", message: "Already identified" }),
            );
          if (users.has(parsedData.userId))
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "User ID already in use",
              }),
            );
          currentUser = parsedData.userId;
          users.set(currentUser!, socket);
          socket.send(
            JSON.stringify({ type: "IDENTIFIED", userId: currentUser }),
          );
        }

        if (parsedData.type === "JOIN_BOARD") {
          if (!currentUser)
            return socket.send(
              JSON.stringify({ type: "ERROR", message: "User not IDENTIFIED" }),
            );

          const { boardId } = parsedData;
          if (!boardId)
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "boardId is required!",
              }),
            );

          let board = boards.get(boardId);
          if (!board) {
            board = {
              users: new Set(),
              objects: new Map(),
              sequenceNumber: 0,
            };
            boards.set(boardId, board);
          }

          if (board.users.has(socket)) {
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "User already in board",
              }),
            );
          }

          board.users.add(socket);

          for (const client of board.users) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "JOIN_BOARD",
                  boardId,
                  message: currentUser + " Joined Board",
                }),
              );
            }
          }
        }

        if (parsedData.type === "CREATE_OBJ") {
          const { boardId, operationId } = parsedData;
          const { id, x, y, text } = parsedData.object;

          if (!currentUser)
            return socket.send(
              JSON.stringify({ type: "ERROR", message: "User not IDENTIFIED" }),
            );

          if (!boardId)
            return socket.send(
              JSON.stringify({ type: "ERROR", message: "boardId is required" }),
            );

          let board = boards.get(boardId);
          if (!board)
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "Board is not available!",
              }),
            );

          if (!board.users.has(socket)) {
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "User not in board",
              }),
            );
          }

          const sequenceNumber = ++board.sequenceNumber;

          board.objects.set(id, { id, x, y, text });

          for (const client of board.users) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "CREATE_OBJ",
                  operationId,
                  sequenceNumber,
                  boardId,
                  object: { id, x, y, text },
                  message: "Object created",
                }),
              );
            }
          }
        }

        if (parsedData.type === "MOVE_OBJ") {
          const { boardId, operationId, objectId, x, y } = parsedData;

          if (!currentUser)
            return socket.send(
              JSON.stringify({ type: "ERROR", message: "User not IDENTIFIED" }),
            );

          if (!boardId)
            return socket.send(
              JSON.stringify({ type: "ERROR", message: "boardId is required" }),
            );

          if (!objectId)
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "objectId is required",
              }),
            );

          let board = boards.get(boardId);
          if (!board)
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "Board is not available!",
              }),
            );

          if (!board.users.has(socket)) {
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "User not in board",
              }),
            );
          }

          let object = board.objects.get(objectId);
          if (!object)
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "Object is not on board!",
              }),
            );

          const sequenceNumber = ++board.sequenceNumber;

          object.x = x;
          object.y = y;

          for (const client of board.users) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "MOVE_OBJ",
                  operationId,
                  sequenceNumber,
                  boardId,
                  object: { objectId, x, y },
                  message: "Object was moved",
                }),
              );
            }
          }
        }

        if (parsedData.type === "DELETE_OBJ") {
          const { boardId, operationId, objectId } = parsedData;

          if (!currentUser)
            return socket.send(
              JSON.stringify({ type: "ERROR", message: "User not IDENTIFIED" }),
            );

          if (!boardId)
            return socket.send(
              JSON.stringify({ type: "ERROR", message: "boardId is required" }),
            );

          let board = boards.get(boardId);
          if (!board)
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "Board is not available!",
              }),
            );

          if (!board.users.has(socket)) {
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "User not in board",
              }),
            );
          }

          if (!board.objects.has(objectId))
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "Object does not exist",
              }),
            );

          const sequenceNumber = ++board.sequenceNumber;

          board.objects.delete(objectId);

          for (const client of board.users) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "DELETE_OBJ",
                  operationId,
                  sequenceNumber,
                  boardId,
                  message: "Object deleted",
                }),
              );
            }
          }
        }

        if (parsedData.type === "SYNC_BOARD") {
          const { boardId } = parsedData;
          if (!currentUser)
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "User not IDENTIFIED",
              }),
            );

          const board = boards.get(boardId);
          if (!board)
            return socket.send(
              JSON.stringify({
                type: "ERROR",
                message: "Board not Exists!",
              }),
            );
          const objects = Array.from(board.objects.values());

          const sequenceNumber = ++board.sequenceNumber;
          socket.send(
            JSON.stringify({
              type: "SYNC_BOARD",
              sequenceNumber,
              boardId,
              objects,
            }),
          );
        }
      } else
        socket.send(
          "Not received a valid JSON object: " + JSON.stringify(parsedData),
        );
    } catch (e) {
      // If parsing fails, treat it as a simple string
      socket.send("Received simple string: " + message);
    }
  });

  socket.on("close", () => {
    if (currentUser) {
      users.delete(currentUser);
      for (const [boardId, board] of boards) {
        board.users.delete(socket);
        if (board.users.size === 0) {
          boards.delete(boardId);
        }
      }
    }
  });
});
