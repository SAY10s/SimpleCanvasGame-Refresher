import { ImageLoader } from "./ImageLoader.js";
import { setupEventListeners } from "./EventHandlers.js";
import { Player } from "./Player.js";
import { Bullet } from "./Bullet.js";
import { soundManager } from "./SoundManager.js";
import { loadingManager } from "./LoadingManager.js";

soundManager.addSound("newRun", "/client/sounds/newRun.mp3");
soundManager.addSound("mainTheme", "/client/sounds/ost/mainTheme.mp3");
soundManager.addSound("firstFloor", "/client/sounds/ost/firstFloorOst.mp3");

soundManager.addSound("tearFall1", "/client/sounds/player/tears/tearFall1.mp3");
soundManager.addSound("tearFall2", "/client/sounds/player/tears/tearFall2.mp3");

class GameClient {
  socket: any;
  selfId: string | null;
  //FIXME: change type
  Img: any;
  ctx: CanvasRenderingContext2D;
  scoreboard: HTMLElement;
  constructor() {
    // @ts-ignore it's imported in index.html
    this.socket = io();

    this.selfId = null;
    this.Img = {};
    let canvas: HTMLCanvasElement = document.getElementById(
      "ctx",
    )! as HTMLCanvasElement;
    // @ts-ignore FIXME: change type (it says that it might be null, even tho i used "!" above)
    this.ctx = canvas.getContext("2d");
    this.scoreboard = document.getElementById("scoreboard")!;
    this.init();
    setupEventListeners(this);
  }

  init() {
    this.Img = ImageLoader.loadImages();
    setInterval(() => this.updateGame(), 10);
  }

  signIn() {
    const usernameInput = document.getElementById(
      "usernameInput",
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      "passwordInput",
    ) as HTMLInputElement;
    const username = usernameInput?.value;
    const password = passwordInput?.value;
    this.socket.emit("signIn", { username, password });
  }

  signUp() {
    const usernameInput = document.getElementById(
      "usernameInput",
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      "passwordInput",
    ) as HTMLInputElement;
    const username = usernameInput?.value;
    const password = passwordInput?.value;
    this.socket.emit("signUp", { username, password });
  }

  handleSignInResponse(data: { success: boolean }) {
    const usernameInput = document.getElementById(
      "usernameInput",
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      "passwordInput",
    ) as HTMLInputElement;
    const signDiv = document.querySelector(".signDiv") as HTMLElement;
    const gameDiv = document.querySelector("#gameDiv") as HTMLElement;
    if (data.success) {
      loadingManager.show(
        () => {
          signDiv.style.display = "none";
          gameDiv.style.display = "flex";
          setTimeout(() => {
            soundManager.playSound("firstFloor", true, 500);
          }, 4000);
        },
        true,
        500,
        true,
        2000,
        3500,
      );

      soundManager.stopSound("mainTheme", true, 300);
      soundManager.playSound("newRun");
    } else {
      usernameInput.value = "";
      passwordInput.value = "";
    }
  }

  handleSignUpResponse(data: { success: boolean }) {
    alert(data.success ? "Sign up successful." : "Sign up unsuccessful.");
  }

  addToChat(data: string) {
    const chatText = document.getElementById("chatMessages") as HTMLDivElement;
    chatText.innerHTML += `<div>${data}</div>`;
    chatText.scrollTop = chatText.scrollHeight;
  }

  handleChatSubmit(event: Event) {
    event.preventDefault();
    const chatInput = document.getElementById(
      "chatTextInput",
    ) as HTMLInputElement;
    if (chatInput.value[0] === "//") {
      this.socket.emit("evalServer", chatInput.value.slice(1));
    } else if (chatInput.value.slice(0, 8).toLowerCase() === "/setname") {
      this.socket.emit("setName", chatInput.value.slice(9));
    } else {
      this.socket.emit("sendMsgToServer", chatInput.value);
    }
    chatInput.value = "";
  }

  handleInit(data: {
    selfId: string | null;
    player: {
      hp: number;
      hpMax: number;
      id: string;
      isClosingEyes: false;
      name: string;
      score: number;
      x: number;
      y: number;
    }[];
    bullet: { id: string; parent: string; x: number; y: number }[];
  }) {
    if (data.selfId) this.selfId = data.selfId;
    for (let playerData of data.player) {
      new Player(playerData, this);
    }
    for (let bulletData of data.bullet) {
      new Bullet(bulletData, this);
    }
  }

  handleUpdate(data: {
    selfId: string | null;
    player: {
      hp: number;
      id: string;
      isClosingEyes: false;
      name: string;
      score: number;
      x: number;
      y: number;
    }[];
    bullet: { id: string; x: number; y: number }[];
  }) {
    for (let pack of data.player) {
      const player = Player.list[pack.id] || new Player(pack, this);
      if (player) player.update(pack);
    }
    for (let pack of data.bullet) {
      const bullet = Bullet.list[pack.id];
      if (bullet) bullet.update(pack);
    }
  }

  handleRemove(data: { player: string[]; bullet: string[] }) {
    for (let id of data.player) {
      const playerScoreDiv = document.getElementById(id);
      if (playerScoreDiv) playerScoreDiv.remove();
      delete Player.list[id];
    }
    for (let id of data.bullet) {
      soundManager.playSound(`tearFall${Math.floor(Math.random() * 2) + 1}`);
      delete Bullet.list[id];
    }
  }

  updateGame() {
    if (!this.selfId) return;
    const player = Player.list[this.selfId];
    if (!player) return;

    // Calculate the offset based on the player's position
    let offsetX = 1600 / 2 - player.x; // Half of canvas width
    let offsetY = 900 / 2 - player.y; // Half of canvas height

    // Check if the offset exceeds the map boundaries
    offsetX = Math.min(Math.max(offsetX, -1600), 0);
    offsetY = Math.min(Math.max(offsetY, -900), 0);

    // Clear the canvas
    this.ctx.clearRect(0, 0, 1600, 900);

    // Draw the map with the offset
    this.ctx.save();
    this.ctx.translate(offsetX, offsetY);
    this.drawMap();

    // Draw each player with the offset
    for (let id in Player.list) {
      Player.list[id].draw();
    }

    // Draw each bullet with the offset
    for (let id in Bullet.list) {
      Bullet.list[id].draw();
    }

    this.ctx.restore();
  }

  drawMap() {
    this.ctx.drawImage(this.Img.map, 0, 0, 1600 * 2, 900 * 2);
  }

  handleKeyEvent(event: KeyboardEvent, type: string) {
    const keyMap: Record<string, string> = {
      d: "pressingRight",
      s: "pressingDown",
      a: "pressingLeft",
      w: "pressingUp",
      k: "shootingRight",
      j: "shootingDown",
      h: "shootingLeft",
      u: "shootingUp",
      ArrowRight: "shootingRight",
      ArrowDown: "shootingDown",
      ArrowLeft: "shootingLeft",
      ArrowUp: "shootingUp",
    };
    if (keyMap[event.key]) {
      this.socket.emit("keyPress", {
        inputId: keyMap[event.key],
        state: type !== "up",
      });
    }
  }
}

export default GameClient;
