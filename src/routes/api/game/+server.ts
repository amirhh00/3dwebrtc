import type { RequestHandler } from '@sveltejs/kit';

type User = {
  isHost: boolean;
  id: string;
  name?: string;
};

const openRooms = new Map<string, User[]>();

/*
import { Server } from 'socket.io';
import type { HttpServer } from 'vite';


export function initializeSocket(httpServer: HttpServer | null) {
  if (!httpServer) {
    console.error('No HTTP server provided');
    return;
  }
  const io = new Server(httpServer);
  io.on('connection', (socket) => {
    // Generate a random username and send it to the client to display it
    socket.emit('name', socket.id);

    socket.on('createRoom', () => {
      if (!openRooms.has(socket.id)) {
        const roomId = randomUUID();
        openRooms.set(roomId, [{ isHost: true, id: socket.id }]);
        socket.emit('roomCreated', { roomId });
      } else {
        socket.emit('err', {
          from: 'Server',
          message: 'You already have an open room',
          time: new Date().getTime()
        });
      }
    });

    socket.on('joinRoom', (room) => {
      if (openRooms.has(room)) {
        const users = openRooms.get(room);
        if (users) {
          users.push({ isHost: false, id: socket.id });
          openRooms.set(room, users);
          socket.emit('roomJoined', room);
          io.to(room).emit('message', {
            from: 'Server',
            message: 'User joined',
            time: new Date().getTime()
          });
        } else {
          socket.emit('err', {
            from: 'Server',
            message: 'Room not found',
            time: new Date().getTime()
          });
        }
      } else {
        socket.emit('err', {
          from: 'Server',
          message: 'Room not found',
          time: new Date().getTime()
        });
      }
    });

    socket.on('getRooms', () => {
      socket.emit('rooms', Array.from(openRooms.keys()));
    });

    // Receive incoming messages and broadcast them to the room the user is in
    socket.on('message', (message) => {
      openRooms.forEach((users, room) => {
        const user = users.find((user) => user.id === socket.id);
        if (user) {
          io.to(room).emit('message', {
            from: user.id,
            message,
            time: new Date().getTime()
          });
        }
      });
    });

    socket.on('disconnect', () => {
      openRooms.forEach((users, room) => {
        const userIndex = users.findIndex((user) => user.id === socket.id);
        if (userIndex !== -1) {
          users.splice(userIndex, 1);
          openRooms.set(room, users);
          io.to(room).emit('message', {
            from: 'Server',
            message: 'User left',
            time: new Date().getTime()
          });
        }
      });
    });
    //
  });
  console.log('SocketIO injected');
}

*/

export const fallback: RequestHandler = async ({ request }) => {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair) as [
    CloudflareWebsocket,
    CloudflareWebsocket
  ];

  server.accept();

  server.addEventListener('message', (event: { data: any }) => {
    console.log(event.data);
  });

  // server.addEventListener('open', () => {
  //   const clientId = crypto.randomUUID().toString();
  //   client.send(clientId);
  // });

  // server.addEventListener('close', (code?: number, reason?: string) => {
  //   console.log('Server closed', code, reason);
  // });

  // server.addEventListener('createRoom', () => {
  //   console.log('createRoom');
  // });

  // client.send('Hello from server');

  return new Response(null, {
    status: 101,
    webSocket: client
  });
};
