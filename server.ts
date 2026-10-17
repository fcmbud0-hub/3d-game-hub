import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

interface PlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  pitch: number;
  isShooting: boolean;
  isJumping: boolean;
  isCrouching: boolean;
  weapon: string;
  health: number;
  shield: number;
  kills: number;
  deaths: number;
  lastUpdate: number;
}

interface Room {
  id: string;
  players: Map<string, { ws: WebSocket; state: PlayerState }>;
  pickups: Array<{
    id: string;
    type: 'health' | 'shield' | 'ammo';
    x: number;
    y: number;
    z: number;
    active: boolean;
    respawnAt: number;
  }>;
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      players: new Map(),
      pickups: [
        { id: 'hp_center', type: 'health', x: 0, y: 1.2, z: 0, active: true, respawnAt: 0 },
        { id: 'shield_north', type: 'shield', x: 0, y: 3.5, z: -25, active: true, respawnAt: 0 },
        { id: 'shield_south', type: 'shield', x: 0, y: 3.5, z: 25, active: true, respawnAt: 0 },
        { id: 'ammo_west', type: 'ammo', x: -25, y: 1.2, z: 0, active: true, respawnAt: 0 },
        { id: 'ammo_east', type: 'ammo', x: 25, y: 1.2, z: 0, active: true, respawnAt: 0 },
        { id: 'hp_top_tower', type: 'health', x: 0, y: 7.2, z: 0, active: true, respawnAt: 0 },
      ],
    };
    rooms.set(roomId, room);
  }
  return room;
}

function broadcastToRoom(room: Room, message: object, excludeWs?: WebSocket) {
  const data = JSON.stringify(message);
  for (const client of room.players.values()) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      rooms: rooms.size,
      time: Date.now(),
    });
  });

  // Room info API endpoint
  app.get('/api/rooms', (_req, res) => {
    const list = Array.from(rooms.entries()).map(([id, room]) => ({
      id,
      playerCount: room.players.size,
    }));
    res.json(list);
  });

  // WebSocket Server Handling
  wss.on('connection', (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let playerId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'join': {
            const requestedRoom = (msg.roomId || 'ARENA-1').trim().toUpperCase();
            currentRoomId = requestedRoom;
            const assignedId: string = msg.playerId || 'p_' + Math.random().toString(36).substring(2, 9);
            playerId = assignedId;

            const room = getOrCreateRoom(requestedRoom);
            const playerState: PlayerState = {
              id: assignedId,
              name: (msg.name || 'Soldier').substring(0, 16),
              color: msg.color || '#00f0ff',
              x: (Math.random() - 0.5) * 30,
              y: 1.5,
              z: (Math.random() - 0.5) * 30,
              rotY: 0,
              pitch: 0,
              isShooting: false,
              isJumping: false,
              isCrouching: false,
              weapon: 'rifle',
              health: 100,
              shield: 50,
              kills: 0,
              deaths: 0,
              lastUpdate: Date.now(),
            };

            room.players.set(assignedId, { ws, state: playerState });

            // Send back self ID and current room snapshot
            const otherPlayers = Array.from(room.players.values())
              .filter((p) => p.state.id !== playerId)
              .map((p) => p.state);

            ws.send(
              JSON.stringify({
                type: 'init',
                yourId: playerId,
                roomId: requestedRoom,
                players: otherPlayers,
                pickups: room.pickups,
              })
            );

            // Announce to other players
            broadcastToRoom(
              room,
              {
                type: 'player_joined',
                player: playerState,
              },
              ws
            );
            break;
          }

          case 'state_update': {
            if (!currentRoomId || !playerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;
            const client = room.players.get(playerId);
            if (!client) return;

            // Update local state
            Object.assign(client.state, {
              x: msg.x ?? client.state.x,
              y: msg.y ?? client.state.y,
              z: msg.z ?? client.state.z,
              rotY: msg.rotY ?? client.state.rotY,
              pitch: msg.pitch ?? client.state.pitch,
              isShooting: !!msg.isShooting,
              isJumping: !!msg.isJumping,
              isCrouching: !!msg.isCrouching,
              weapon: msg.weapon || client.state.weapon,
              lastUpdate: Date.now(),
            });

            // Broadcast movement to others in room
            broadcastToRoom(
              room,
              {
                type: 'player_moved',
                id: playerId,
                x: client.state.x,
                y: client.state.y,
                z: client.state.z,
                rotY: client.state.rotY,
                pitch: client.state.pitch,
                isShooting: client.state.isShooting,
                isJumping: client.state.isJumping,
                isCrouching: client.state.isCrouching,
                weapon: client.state.weapon,
              },
              ws
            );
            break;
          }

          case 'shoot': {
            if (!currentRoomId || !playerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            broadcastToRoom(
              room,
              {
                type: 'player_shot',
                shooterId: playerId,
                origin: msg.origin,
                direction: msg.direction,
                weapon: msg.weapon,
              },
              ws
            );
            break;
          }

          case 'hit': {
            if (!currentRoomId || !playerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const target = room.players.get(msg.targetId);
            const shooter = room.players.get(playerId);
            if (!target) return;

            const damage = Math.max(1, Math.min(100, msg.damage || 20));
            let remainingDamage = damage;

            // Shield absorbs first
            if (target.state.shield > 0) {
              const absorbed = Math.min(target.state.shield, remainingDamage);
              target.state.shield -= absorbed;
              remainingDamage -= absorbed;
            }

            if (remainingDamage > 0) {
              target.state.health = Math.max(0, target.state.health - remainingDamage);
            }

            // Notify target & others
            broadcastToRoom(room, {
              type: 'player_damaged',
              targetId: msg.targetId,
              shooterId: playerId,
              damage,
              health: target.state.health,
              shield: target.state.shield,
              headshot: !!msg.headshot,
            });

            // Check if killed
            if (target.state.health <= 0) {
              target.state.deaths++;
              if (shooter) {
                shooter.state.kills++;
              }

              broadcastToRoom(room, {
                type: 'player_killed',
                victimId: target.state.id,
                victimName: target.state.name,
                killerId: playerId,
                killerName: shooter ? shooter.state.name : 'Unknown',
                weapon: msg.weapon || 'rifle',
                headshot: !!msg.headshot,
                scores: Array.from(room.players.values()).map((p) => ({
                  id: p.state.id,
                  kills: p.state.kills,
                  deaths: p.state.deaths,
                })),
              });

              // Respawn after 3 seconds
              setTimeout(() => {
                if (room.players.has(target.state.id)) {
                  target.state.health = 100;
                  target.state.shield = 50;
                  target.state.x = (Math.random() - 0.5) * 36;
                  target.state.y = 1.5;
                  target.state.z = (Math.random() - 0.5) * 36;

                  broadcastToRoom(room, {
                    type: 'player_respawned',
                    id: target.state.id,
                    x: target.state.x,
                    y: target.state.y,
                    z: target.state.z,
                    health: 100,
                    shield: 50,
                  });
                }
              }, 3000);
            }
            break;
          }

          case 'collect_pickup': {
            if (!currentRoomId || !playerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const pickup = room.pickups.find((p) => p.id === msg.pickupId);
            const player = room.players.get(playerId);
            if (pickup && pickup.active && player) {
              pickup.active = false;
              pickup.respawnAt = Date.now() + 15000;

              if (pickup.type === 'health') {
                player.state.health = Math.min(100, player.state.health + 40);
              } else if (pickup.type === 'shield') {
                player.state.shield = Math.min(100, player.state.shield + 50);
              }

              broadcastToRoom(room, {
                type: 'pickup_collected',
                pickupId: pickup.id,
                collectorId: playerId,
                health: player.state.health,
                shield: player.state.shield,
              });

              // Respawn pickup after 15s
              setTimeout(() => {
                pickup.active = true;
                pickup.respawnAt = 0;
                broadcastToRoom(room, {
                  type: 'pickup_respawned',
                  pickupId: pickup.id,
                });
              }, 15000);
            }
            break;
          }

          case 'chat': {
            if (!currentRoomId || !playerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;
            const player = room.players.get(playerId);
            if (!player) return;

            broadcastToRoom(room, {
              type: 'chat_message',
              senderId: playerId,
              senderName: player.state.name,
              senderColor: player.state.color,
              text: String(msg.text || '').substring(0, 100),
              timestamp: Date.now(),
            });
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', clientTime: msg.time, serverTime: Date.now() }));
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.players.delete(playerId);
          broadcastToRoom(room, {
            type: 'player_left',
            id: playerId,
          });

          // Cleanup empty room after 5 minutes
          if (room.players.size === 0 && currentRoomId !== 'ARENA-1') {
            setTimeout(() => {
              if (room.players.size === 0) {
                rooms.delete(currentRoomId!);
              }
            }, 300000);
          }
        }
      }
    });
  });

  // Attach Vite middleware in development
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Cyber Arena 3D] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
