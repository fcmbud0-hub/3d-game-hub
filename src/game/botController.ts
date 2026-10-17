import * as THREE from 'three';
import { NetworkPlayer, WeaponType, WEAPONS } from '../types/game';
import { CollisionBox } from './arena';
import { createPlayerCharacterModel } from './proceduralModels';
import { sounds } from '../audio/soundEffects';

export interface BotState {
  player: NetworkPlayer;
  mesh: THREE.Group;
  targetPos: THREE.Vector3;
  velocity: THREE.Vector3;
  nextFireTime: number;
  strafeTimer: number;
  strafeDir: number;
  waypointIndex: number;
}

const BOT_NAMES = ['CyberGhost', 'Viper-9', 'Phantom', 'NexusX', 'IronClad', 'ShadowOps'];
const BOT_COLORS = ['#ff0055', '#ffaa00', '#aa00ff', '#00ff66', '#ff5500', '#00e5ff'];

export class BotManager {
  public bots: BotState[] = [];
  private scene: THREE.Scene;
  private waypoints: THREE.Vector3[] = [
    new THREE.Vector3(-25, 0, -25),
    new THREE.Vector3(25, 0, -25),
    new THREE.Vector3(25, 0, 25),
    new THREE.Vector3(-25, 0, 25),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-15, 0, 0),
    new THREE.Vector3(15, 0, 0),
    new THREE.Vector3(0, 6.3, 0), // center tower
    new THREE.Vector3(-26, 3.5, -26), // sniper corner
    new THREE.Vector3(26, 3.5, 26), // sniper corner
  ];

  public onBotShoot?: (bot: NetworkPlayer, origin: THREE.Vector3, direction: THREE.Vector3, weapon: WeaponType) => void;
  public onBotKill?: (bot: NetworkPlayer, victim: NetworkPlayer) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public addBot(count = 1) {
    for (let i = 0; i < count; i++) {
      const idx = this.bots.length % BOT_NAMES.length;
      const id = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const name = BOT_NAMES[idx];
      const color = BOT_COLORS[idx];

      const spawnWp = this.waypoints[Math.floor(Math.random() * this.waypoints.length)].clone();
      spawnWp.x += (Math.random() - 0.5) * 8;
      spawnWp.z += (Math.random() - 0.5) * 8;

      const player: NetworkPlayer = {
        id,
        name: `[BOT] ${name}`,
        color,
        x: spawnWp.x,
        y: spawnWp.y + 1.0,
        z: spawnWp.z,
        rotY: 0,
        pitch: 0,
        isShooting: false,
        isJumping: false,
        isCrouching: false,
        weapon: Math.random() > 0.4 ? 'rifle' : Math.random() > 0.5 ? 'shotgun' : 'railgun',
        health: 100,
        shield: 50,
        kills: 0,
        deaths: 0,
        isBot: true,
      };

      const mesh = createPlayerCharacterModel(color, player.name);
      mesh.position.set(player.x, player.y, player.z);
      this.scene.add(mesh);

      this.bots.push({
        player,
        mesh,
        targetPos: this.waypoints[Math.floor(Math.random() * this.waypoints.length)].clone(),
        velocity: new THREE.Vector3(),
        nextFireTime: performance.now() + 1000 + Math.random() * 1500,
        strafeTimer: 0,
        strafeDir: 1,
        waypointIndex: Math.floor(Math.random() * this.waypoints.length),
      });
    }
  }

  public removeBots() {
    this.bots.forEach((b) => {
      this.scene.remove(b.mesh);
    });
    this.bots = [];
  }

  public update(
    dt: number,
    localPlayerPos: THREE.Vector3,
    localPlayerHealth: number,
    allHumanPlayers: NetworkPlayer[],
    colliders: CollisionBox[]
  ) {
    const clampedDt = Math.min(dt, 0.05);
    const now = performance.now();

    // Potential human targets
    const targets = [{ pos: localPlayerPos, hp: localPlayerHealth, id: 'local' }];
    allHumanPlayers.forEach((p) => {
      if (p.health > 0) {
        targets.push({ pos: new THREE.Vector3(p.x, p.y, p.z), hp: p.health, id: p.id });
      }
    });

    for (const bot of this.bots) {
      if (bot.player.health <= 0) continue;

      // 1. Find nearest valid opponent target
      let nearestDist = 9999;
      let activeTarget: THREE.Vector3 | null = null;

      for (const t of targets) {
        if (t.hp <= 0) continue;
        const d = bot.mesh.position.distanceTo(t.pos);
        if (d < nearestDist && d < 65) {
          nearestDist = d;
          activeTarget = t.pos;
        }
      }

      // 2. Navigation & Movement
      const moveDir = new THREE.Vector3();

      if (activeTarget && nearestDist < 50) {
        // Combat positioning: Face target, strafe left/right, maintain medium range (12-25m)
        const toTarget = activeTarget.clone().sub(bot.mesh.position);
        toTarget.y = 0;
        toTarget.normalize();

        const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
        bot.player.rotY = THREE.MathUtils.damp(bot.player.rotY, desiredYaw, 10, clampedDt);

        // Strafe logic
        bot.strafeTimer -= clampedDt;
        if (bot.strafeTimer <= 0) {
          bot.strafeDir = Math.random() > 0.5 ? 1 : -1;
          bot.strafeTimer = 1.0 + Math.random() * 2.0;
        }

        const strafeVec = new THREE.Vector3(-toTarget.z, 0, toTarget.x).multiplyScalar(bot.strafeDir);

        if (nearestDist > 22) {
          // Move closer
          moveDir.add(toTarget.multiplyScalar(0.7));
        } else if (nearestDist < 8) {
          // Back up
          moveDir.add(toTarget.multiplyScalar(-0.8));
        }
        moveDir.add(strafeVec.multiplyScalar(0.6));

        // 3. Firing weapon at target
        if (now >= bot.nextFireTime) {
          const cfg = WEAPONS[bot.player.weapon];
          bot.nextFireTime = now + (1000 / cfg.fireRate) * (0.9 + Math.random() * 0.4);

          // Aim with slight realistic inaccuracy
          const spread = 0.04;
          const aimDir = activeTarget
            .clone()
            .add(new THREE.Vector3((Math.random() - 0.5) * spread * nearestDist, 1.2 + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * nearestDist))
            .sub(bot.mesh.position)
            .normalize();

          const origin = bot.mesh.position.clone();
          origin.y += 1.4;

          if (this.onBotShoot) {
            this.onBotShoot(bot.player, origin, aimDir, bot.player.weapon);
          }
        }
      } else {
        // Patrol mode
        const toWp = bot.targetPos.clone().sub(bot.mesh.position);
        toWp.y = 0;
        const distToWp = toWp.length();

        if (distToWp < 3) {
          // Switch waypoint
          bot.waypointIndex = (bot.waypointIndex + 1) % this.waypoints.length;
          bot.targetPos = this.waypoints[bot.waypointIndex].clone();
          bot.targetPos.x += (Math.random() - 0.5) * 6;
          bot.targetPos.z += (Math.random() - 0.5) * 6;
        } else {
          toWp.normalize();
          moveDir.copy(toWp);
          bot.player.rotY = THREE.MathUtils.damp(bot.player.rotY, Math.atan2(toWp.x, toWp.z), 6, clampedDt);
        }
      }

      // Physics update for bot
      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
      }
      const botSpeed = 8.5;
      bot.velocity.x = THREE.MathUtils.damp(bot.velocity.x, moveDir.x * botSpeed, 12, clampedDt);
      bot.velocity.z = THREE.MathUtils.damp(bot.velocity.z, moveDir.z * botSpeed, 12, clampedDt);
      bot.velocity.y -= 25.0 * clampedDt;

      const nextPos = bot.mesh.position.clone().addScaledVector(bot.velocity, clampedDt);

      // Floor & simple obstacle collision
      for (const box of colliders) {
        if (box.jumpPad) {
          if (
            nextPos.x >= box.min.x &&
            nextPos.x <= box.max.x &&
            nextPos.z >= box.min.z &&
            nextPos.z <= box.max.z &&
            bot.mesh.position.y <= box.max.y + 0.5
          ) {
            bot.velocity.y = 22.0;
            sounds.playJumpPad();
          }
          continue;
        }

        const isOverX = nextPos.x + 0.4 > box.min.x && nextPos.x - 0.4 < box.max.x;
        const isOverZ = nextPos.z + 0.4 > box.min.z && nextPos.z - 0.4 < box.max.z;

        if (isOverX && isOverZ && bot.mesh.position.y >= box.max.y - 0.3 && nextPos.y <= box.max.y + 0.1) {
          nextPos.y = box.max.y;
          bot.velocity.y = 0;
        }
      }

      if (nextPos.y <= 0) {
        nextPos.y = 0;
        bot.velocity.y = 0;
      }

      nextPos.x = Math.max(-44, Math.min(44, nextPos.x));
      nextPos.z = Math.max(-44, Math.min(44, nextPos.z));

      bot.mesh.position.copy(nextPos);
      bot.mesh.rotation.y = bot.player.rotY;

      bot.player.x = nextPos.x;
      bot.player.y = nextPos.y;
      bot.player.z = nextPos.z;
    }
  }

  public damageBot(botId: string, damage: number, attackerName: string): { killed: boolean; bot?: NetworkPlayer } {
    const botState = this.bots.find((b) => b.player.id === botId);
    if (!botState || botState.player.health <= 0) return { killed: false };

    let remaining = damage;
    if (botState.player.shield > 0) {
      const absorbed = Math.min(botState.player.shield, remaining);
      botState.player.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) {
      botState.player.health = Math.max(0, botState.player.health - remaining);
    }

    // Update billboard health bar
    const updateFn = (botState.mesh as unknown as { updateHP?: (hp: number, shield: number) => void }).updateHP;
    if (updateFn) {
      updateFn(botState.player.health, botState.player.shield);
    }

    if (botState.player.health <= 0) {
      botState.player.deaths++;
      botState.mesh.visible = false;

      // Respawn bot after 3.5 seconds
      setTimeout(() => {
        if (botState) {
          const wp = this.waypoints[Math.floor(Math.random() * this.waypoints.length)];
          botState.mesh.position.set(wp.x, wp.y, wp.z);
          botState.player.health = 100;
          botState.player.shield = 50;
          botState.mesh.visible = true;
          if (updateFn) updateFn(100, 50);
        }
      }, 3500);

      return { killed: true, bot: botState.player };
    }

    return { killed: false, bot: botState.player };
  }
}
