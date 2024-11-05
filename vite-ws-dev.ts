import { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import type { HttpServer } from "vite";
import type {
  Message,
  RoomState,
  RoomStateChanged,
  SeekRoom,
  UserDetails,
  WebRTCData,
} from "$lib/@types/user.type";
import type { GameSettings } from "$lib/@types/3D.type";

const openRooms = new Map<string, RoomState>();

export interface EventsFromClients {
  createRoom: (
    userDetails: UserDetails,
    rtcData: WebRTCData,
    callBackFn: (data: { roomId: string }) => { roomId: string },
  ) => void;
  seekRooms: (callBackFn: (availableRooms: SeekRoom[]) => void) => void;
  joinRoom: (
    roomId: string,
    rtcData: WebRTCData,
    gameSettings: GameSettings,
    callBackFn: (room: RoomState) => void,
  ) => void;
  selectRoom: (
    roomId: string,
    callBackFn: (roomDetails: RoomState) => void,
  ) => void;
  message: (msg: string) => void;
  name: (name: string) => void;
  disconnect: () => void;
}

export interface EventsToClients {
  name: (name: string) => void;
  err: (data: { from: string; message: string; time: number }) => void;
  roomState: (data: RoomStateChanged) => void;
  message: (data: Message) => void;
}

export function initializeSocket(httpServer: HttpServer | null) {
  if (!httpServer) {
    throw new Error("HTTP server not found");
    return;
  }
  const io = new Server<EventsFromClients, EventsToClients>(httpServer);
  io.on("connection", (socket) => {
    socket.on("createRoom", (userDetails, rtcData, callBackFn) => {
      if (!openRooms.has(socket.id)) {
        const roomId = randomUUID();
        const users = [
          {
            isHost: true,
            id: socket.id,
            color: userDetails?.color,
            name: userDetails?.name,
            rtcData,
          },
        ];
        const roomState: RoomState = {
          messages: [],
          users,
        };
        // make a new room in socket.io
        socket.join(roomId);
        openRooms.set(roomId, roomState);
        callBackFn({ roomId });
      } else {
        socket.emit("err", {
          from: "Server",
          message: "You already have an open room",
          time: new Date().getTime(),
        });
      }
    });

    socket.on(
      "seekRooms",
      (callBackFn: (availableRooms: SeekRoom[]) => void) => {
        // send the list of open rooms (id, name) to the client
        const rooms: SeekRoom[] = [];
        openRooms.forEach((roomState, roomId) => {
          const roomName = roomState.users.find((user) => user.isHost)?.name ||
            roomId;
          // return if it's the room that socket is already in
          if (roomState.users.find((user) => user.id === socket.id)) return;
          rooms.push({
            roomId,
            roomName,
            playersCount: roomState.users.length,
          });
        });
        callBackFn(rooms);
      },
    );

    socket.on(
      "selectRoom",
      (roomId: string, callBackFn: (roomDetails: RoomState) => void) => {
        // send the room details to the client
        if (openRooms.has(roomId)) {
          callBackFn(openRooms.get(roomId)!);
        } else {
          socket.emit("err", {
            from: "Server",
            message: "Room not found",
            time: new Date().getTime(),
          });
        }
      },
    );

    socket.on(
      "joinRoom",
      (
        roomId: string,
        rtcData: WebRTCData,
        gameSettings: GameSettings,
        callBackFn: (roomState: RoomState) => void,
      ) => {
        if (
          openRooms.has(roomId) &&
          openRooms.get(roomId)?.users &&
          openRooms.get(roomId)!.users.length > 0
        ) {
          const room = openRooms.get(roomId)!;
          const users = room.users;
          users.push({
            isHost: false,
            id: socket.id,
            rtcData,
            name: gameSettings.playerName,
            color: gameSettings.playerColor,
          });
          openRooms.set(roomId, { users });
          socket.broadcast.to(roomId).emit("roomState", {
            from: "Server",
            event: "user_joined",
            user: socket.id,
            users,
            time: new Date().getTime(),
          } as RoomStateChanged);
          socket.join(roomId);
          callBackFn(room);
        } else {
          socket.emit("err", {
            from: "Server",
            message: "Room not found",
            time: new Date().getTime(),
          });
        }
      },
    );

    // Receive incoming messages and broadcast them to the room the user is in
    socket.on("message", (msg: string) => {
      openRooms.forEach((roomState, room) => {
        const user = roomState.users.find((user) => user.id === socket.id);
        if (user) {
          const message: Message = {
            from: user,
            message: msg,
            time: new Date().getTime(),
          };
          roomState.messages?.push(message);
          io.to(room).emit("message", message);
        }
      });
    });

    socket.on("name", (name: string) => {
      // change the name of the user in the room they are in
      openRooms.forEach((roomState, room) => {
        const user = roomState.users.find((user) => user.id === socket.id);
        if (user) {
          user.name = name;
          io.to(room).emit("roomState", {
            from: "Server",
            event: "user_name_changed",
            user: socket.id,
            users: roomState.users,
            time: new Date().getTime(),
          } as RoomStateChanged);
        }
      });
    });

    socket.on("disconnect", () => {
      openRooms.forEach((roomState, room) => {
        const userIndex = roomState.users.findIndex((user) =>
          user.id === socket.id
        );
        if (userIndex !== -1) {
          // if at least one user is left in the room, broadcast the user_left event
          roomState.users.splice(userIndex, 1);
          if (roomState.users.length > 0) {
            io.to(room).emit("roomState", {
              from: "Server",
              event: "user_left",
              user: socket.id,
              users: roomState.users,
              time: new Date().getTime(),
            } as RoomStateChanged);
          } else {
            // if the room is empty, delete it
            openRooms.delete(room);
          }
        }
      });
    });
    //
  });
  console.log("SocketIO injected");
}
