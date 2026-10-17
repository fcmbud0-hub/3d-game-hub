import { NetworkPlayer, PickupItem, WeaponType, ChatMessage } from '../types/game';

export interface ClientSocketCallbacks {
  onInit: (yourId: string, roomId: string, players: NetworkPlayer[], pickups: PickupItem[]) => void;
  onPlayerJoined: (player: NetworkPlayer) => void;
  onPlayerMoved: (data: {
    id: string;
    x: number;
    y: number;
    z: number;
    rotY: number;
    pitch: number;
    isShooting: boolean;
    isJumping: boolean;
    isCrouching: boolean;
    weapon: WeaponType;
  }) => void;
  onPlayerShot: (data: {
    shooterId: string;
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
    weapon: WeaponType;
  }) => void;
  onPlayerDamaged: (data: {
    targetId: string;
    shooterId: string;
    damage: number;
    health: number;
    shield: number;
    headshot: boolean;
  }) => void;
  onPlayerKilled: (data: {
    victimId: string;
    victimName: string;
    killerId: string;
    killerName: string;
    weapon: string;
    headshot: boolean;
    scores: Array<{ id: string; kills: number; deaths: number }>;
  }) => void;
  onPlayerRespawned: (data: { id: string; x: number; y: number; z: number; health: number; shield: number }) => void;
  onPickupCollected: (data: { pickupId: string; collectorId: string; health: number; shield: number }) => void;
  onPickupRespawned: (data: { pickupId: string }) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onPlayerLeft: (id: string) => void;
  onPing: (pingMs: number) => void;
  onConnectionChange: (connected: boolean) => void;
}

export class GameNetworkClient {
  private ws: WebSocket | null = null;
  private callbacks: ClientSocketCallbacks;
  private isConnected: boolean = false;
  private pingInterval: number | null = null;
  private lastPingSent: number = 0;
  private lastStateSent: number = 0;
  private sendThrottleMs: number = 33; // ~30Hz updates
  private reconnectTimer: number | null = null;
  private activeRoomId: string = 'ARENA-1';
  private playerName: string = 'Soldier';
  private playerColor: string = '#00f0ff';

  constructor(callbacks: ClientSocketCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(roomId: string, name: string, color: string) {
    this.activeRoomId = roomId;
    this.playerName = name;
    this.playerColor = color;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.callbacks.onConnectionChange(true);

        // Join room
        this.send({
          type: 'join',
          roomId: this.activeRoomId,
          name: this.playerName,
          color: this.playerColor,
        });

        // Start ping loop
        this.startPingLoop();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.callbacks.onConnectionChange(false);
        this.stopPingLoop();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        this.isConnected = false;
      };
    } catch (err) {
      console.error('WebSocket connection failed:', err);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.stopPingLoop();
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.callbacks.onConnectionChange(false);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected && this.activeRoomId) {
        this.connect(this.activeRoomId, this.playerName, this.playerColor);
      }
    }, 3000);
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingInterval = window.setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingSent = performance.now();
        this.send({ type: 'ping', time: this.lastPingSent });
      }
    }, 2500);
  }

  private stopPingLoop() {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private send(data: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public sendState(
    x: number,
    y: number,
    z: number,
    rotY: number,
    pitch: number,
    isShooting: boolean,
    isJumping: boolean,
    isCrouching: boolean,
    weapon: WeaponType
  ) {
    const now = performance.now();
    if (now - this.lastStateSent < this.sendThrottleMs && !isShooting) {
      return;
    }
    this.lastStateSent = now;

    this.send({
      type: 'state_update',
      x,
      y,
      z,
      rotY,
      pitch,
      isShooting,
      isJumping,
      isCrouching,
      weapon,
    });
  }

  public sendShoot(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    weapon: WeaponType
  ) {
    this.send({
      type: 'shoot',
      origin,
      direction,
      weapon,
    });
  }

  public sendHit(targetId: string, damage: number, weapon: WeaponType, headshot: boolean) {
    this.send({
      type: 'hit',
      targetId,
      damage,
      weapon,
      headshot,
    });
  }

  public sendCollectPickup(pickupId: string) {
    this.send({
      type: 'collect_pickup',
      pickupId,
    });
  }

  public sendChat(text: string) {
    this.send({
      type: 'chat',
      text,
    });
  }

  private handleMessage(msg: { type: string; [key: string]: unknown }) {
    switch (msg.type) {
      case 'init':
        this.callbacks.onInit(
          msg.yourId as string,
          msg.roomId as string,
          (msg.players || []) as NetworkPlayer[],
          (msg.pickups || []) as PickupItem[]
        );
        break;

      case 'player_joined':
        this.callbacks.onPlayerJoined(msg.player as NetworkPlayer);
        break;

      case 'player_moved':
        this.callbacks.onPlayerMoved(
          msg as unknown as {
            id: string;
            x: number;
            y: number;
            z: number;
            rotY: number;
            pitch: number;
            isShooting: boolean;
            isJumping: boolean;
            isCrouching: boolean;
            weapon: WeaponType;
          }
        );
        break;

      case 'player_shot':
        this.callbacks.onPlayerShot(
          msg as unknown as {
            shooterId: string;
            origin: { x: number; y: number; z: number };
            direction: { x: number; y: number; z: number };
            weapon: WeaponType;
          }
        );
        break;

      case 'player_damaged':
        this.callbacks.onPlayerDamaged(
          msg as unknown as {
            targetId: string;
            shooterId: string;
            damage: number;
            health: number;
            shield: number;
            headshot: boolean;
          }
        );
        break;

      case 'player_killed':
        this.callbacks.onPlayerKilled(
          msg as unknown as {
            victimId: string;
            victimName: string;
            killerId: string;
            killerName: string;
            weapon: string;
            headshot: boolean;
            scores: Array<{ id: string; kills: number; deaths: number }>;
          }
        );
        break;

      case 'player_respawned':
        this.callbacks.onPlayerRespawned(
          msg as unknown as { id: string; x: number; y: number; z: number; health: number; shield: number }
        );
        break;

      case 'pickup_collected':
        this.callbacks.onPickupCollected(
          msg as unknown as { pickupId: string; collectorId: string; health: number; shield: number }
        );
        break;

      case 'pickup_respawned':
        this.callbacks.onPickupRespawned(msg as unknown as { pickupId: string });
        break;

      case 'chat_message':
        this.callbacks.onChatMessage({
          id: 'chat_' + Math.random(),
          senderName: String(msg.senderName || 'Player'),
          senderColor: String(msg.senderColor || '#00f0ff'),
          text: String(msg.text || ''),
          timestamp: Number(msg.timestamp || Date.now()),
        });
        break;

      case 'player_left':
        this.callbacks.onPlayerLeft(String(msg.id));
        break;

      case 'pong': {
        const ping = Math.max(1, Math.round(performance.now() - this.lastPingSent));
        this.callbacks.onPing(ping);
        break;
      }
    }
  }
}
