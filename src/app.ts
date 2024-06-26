import express from "express";
import { Player, Bullet } from "./server/PlayerAndBullet.js";
import { initPack, removePack } from "./server/Packs.js";
import { EXPECTED_FPS } from "./server/settings.js";
import { Server as HttpServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Server as SocketServer, Socket } from "socket.io";
import {
  isValidPassword,
  isUsernameTaken,
  addUser,
} from "./server/test/testDbConnection.js";

// ------------------------------ SERVER SETUP ------------------------------
const app = express();
const server = new HttpServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 2000;
const DEBUG = true;
const SOCKET_LIST: { [id: string]: Socket } = {};
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "/client/index.html"));
});

app.use("/client", express.static(join(__dirname, "/client")));

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}.`);
});

// ------------------------------ SOCKET SETUP ------------------------------
const io = new SocketServer(server, {});

io.on("connection", (socket) => {
  const id = socket.id;
  SOCKET_LIST[id] = socket;
  console.log(`Player connected: ${id}`);

  socket.on("signIn", async (data) => {
    const isValid = await isValidPassword(data);
    socket.emit("signInResponse", { success: isValid });
    if (isValid) Player.onConnect(socket, data.username);
  });

  socket.on("signUp", async (data) => {
    const usernameTaken = await isUsernameTaken(data);
    if (!usernameTaken) {
      await addUser(data);
      socket.emit("signUpResponse", { success: true });
    } else {
      socket.emit("signUpResponse", { success: false });
    }
  });

  socket.on("disconnect", () => {
    delete SOCKET_LIST[id];
    Player.onDisconnect(socket);
    console.log(`Player disconnected: ${id}`);
  });

  socket.on("sendMsgToServer", (data) => {
    const playerName = Player.list[id]?.name || "Unknown";
    for (const socketId in SOCKET_LIST) {
      SOCKET_LIST[socketId].emit("addToChat", `${playerName}: ${data}`);
    }
  });

  socket.on("evalServer", (data) => {
    if (DEBUG) {
      try {
        const res = eval(data);
        socket.emit("evalAnswer", res);
      } catch (e: any) {
        socket.emit("evalAnswer", `Error: ${e.message}`);
      }
    }
  });

  socket.on("setName", (data) => {
    if (Player.list[id]) {
      Player.list[id].name = data;
      console.log(`Player name set to: ${Player.list[id].name}`);
    }
  });
});

// ------------------------------ GAME LOOP ------------------------------
setInterval(() => {
  const pack = {
    player: Player.update(),
    bullet: Bullet.update(),
  };

  for (const socketId in SOCKET_LIST) {
    const socket = SOCKET_LIST[socketId];
    socket.emit("init", initPack);
    socket.emit("update", pack);
    socket.emit("remove", removePack);
  }

  initPack.player = [];
  initPack.bullet = [];
  removePack.player = [];
  removePack.bullet = [];
}, 1000 / EXPECTED_FPS);
