import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { buildTacticalArena, ArenaData } from './game/arena';
import { FPSController } from './game/fpsControls';
import { BotManager } from './game/botController';
import { GameNetworkClient } from './network/clientSocket';
import {
  createPlayerCharacterModel,
  createFirstPersonWeapon,
} from './game/proceduralModels';
import { sounds } from './audio/soundEffects';
import {
  WeaponType,
  WEAPONS,
  NetworkPlayer,
  PickupItem,
  KillEvent,
  ChatMessage,
  DamageNumber,
} from './types/game';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { ScoreboardModal } from './components/ScoreboardModal';
import { TouchControls } from './components/TouchControls';

// Pre-allocated math objects to avoid garbage collection inside render loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _screenVec = new THREE.Vector3();

interface BulletTracer {
  mesh: THREE.Line | THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface SparkParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  life: number;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  // App / Game Flow State
  const [gameState, setGameState] = useState<'title' | 'playing' | 'gameover'>('title');
  const [isMuted, setIsMuted] = useState(false);
  const [roomId, setRoomId] = useState('ARENA-1');
  const [localPlayerName, setLocalPlayerName] = useState('Soldier');
  const [localPlayerColor, setLocalPlayerColor] = useState('#00f0ff');
  const [localPlayerId, setLocalPlayerId] = useState<string>('local');
  const [isSoloPractice, setIsSoloPractice] = useState(false);

  // In-Game UI States
  const [health, setHealth] = useState(100);
  const [shield, setShield] = useState(50);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('rifle');
  const [ammo, setAmmo] = useState(WEAPONS.rifle.magazineSize);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadProgress, setReloadProgress] = useState(0);
  const [isAiming, setIsAiming] = useState(false);
  const [isThirdPerson, setIsThirdPerson] = useState(false);
  const [mouseSensitivity, setMouseSensitivity] = useState(0.0022);
  const [ping, setPing] = useState(12);
  const [playerCount, setPlayerCount] = useState(1);
  const [hitMarkerActive, setHitMarkerActive] = useState(false);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [myKills, setMyKills] = useState(0);
  const [myDeaths, setMyDeaths] = useState(0);
  const [allPlayersList, setAllPlayersList] = useState<NetworkPlayer[]>([]);

  // Engine & System Refs
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const fpsControllerRef = useRef<FPSController | null>(null);
  const botManagerRef = useRef<BotManager | null>(null);
  const networkClientRef = useRef<GameNetworkClient | null>(null);
  const arenaDataRef = useRef<ArenaData | null>(null);

  // 3D Subject Meshes
  const localPlayerMeshRef = useRef<THREE.Group | null>(null);
  const fpsWeaponMeshRef = useRef<THREE.Group | null>(null);
  const remotePlayersRef = useRef<Map<string, { mesh: THREE.Group; target: NetworkPlayer }>>(new Map());
  const tracersRef = useRef<BulletTracer[]>([]);
  const sparksRef = useRef<SparkParticle[]>([]);
  const sparksMeshRef = useRef<THREE.InstancedMesh | null>(null);

  // Animation frame
  const animFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Helper: Trigger screen damage number
  const spawnDamageNumber = useCallback((worldPos: THREE.Vector3, dmg: number, headshot: boolean) => {
    if (!cameraRef.current) return;
    _screenVec.copy(worldPos);
    _screenVec.project(cameraRef.current);

    if (_screenVec.z < 1) {
      const x = ((_screenVec.x + 1) / 2) * window.innerWidth;
      const y = ((-_screenVec.y + 1) / 2) * window.innerHeight;

      setDamageNumbers((prev) => [
        ...prev.slice(-8),
        {
          id: 'dmg_' + Math.random(),
          damage: dmg,
          x,
          y,
          headshot,
          createdAt: performance.now(),
        },
      ]);
    }
  }, []);

  // Helper: Spawn visual bullet tracer
  const spawnTracer = useCallback((start: THREE.Vector3, end: THREE.Vector3, colorHex = 0x00f0ff) => {
    if (!sceneRef.current) return;

    const points = [start.clone(), end.clone()];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      linewidth: 2,
    });
    const line = new THREE.Line(geom, mat);
    sceneRef.current.add(line);

    tracersRef.current.push({
      mesh: line,
      start: start.clone(),
      end: end.clone(),
      life: 0.12,
      maxLife: 0.12,
    });
  }, []);

  // Helper: Spawn impact sparks
  const spawnImpactSparks = useCallback((pos: THREE.Vector3, normal: THREE.Vector3, colorHex = '#00f0ff') => {
    const col = new THREE.Color(colorHex);
    for (let i = 0; i < 8; i++) {
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6
      ).addScaledVector(normal, 4);

      sparksRef.current.push({
        pos: pos.clone(),
        vel: spread,
        color: col,
        life: 0.35 + Math.random() * 0.25,
      });
    }
  }, []);

  // Initialize Three.js WebGL & Scene once
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Renderer Setup
    const width = mountRef.current.clientWidth || window.innerWidth;
    const height = mountRef.current.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 300);
    camera.position.set(0, 18, 38);
    camera.lookAt(0, 4, 0);
    cameraRef.current = camera;

    // 3. Build Tactical Arena
    const arena = buildTacticalArena(renderer);
    sceneRef.current = arena.scene;
    arenaDataRef.current = arena;

    // 4. InstancedMesh for fast spark particles
    const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sparksMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, 150);
    sparksMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    arena.scene.add(sparksMesh);
    sparksMeshRef.current = sparksMesh;

    // 5. FPS Controller
    const fps = new FPSController(camera, renderer.domElement);
    fpsControllerRef.current = fps;

    // 6. Bot Manager
    const bots = new BotManager(arena.scene);
    botManagerRef.current = bots;

    // Bot shoot listener
    bots.onBotShoot = (bot, origin, direction, weapon) => {
      spawnTracer(origin, origin.clone().addScaledVector(direction, 45), 0xffaa00);
      sounds.playShoot(weapon);

      // Check if bot hits local player
      _raycaster.set(origin, direction);
      const playerPos = fps.position.clone();
      playerPos.y += 1.0;
      const distToPlayer = origin.distanceTo(playerPos);

      if (distToPlayer < 50) {
        // Player hitbox bounding
        const box = new THREE.Box3().setFromCenterAndSize(playerPos, new THREE.Vector3(1.0, 1.8, 1.0));
        const intersect = _raycaster.ray.intersectsBox(box);

        if (intersect) {
          const cfg = WEAPONS[weapon];
          const damage = Math.round(cfg.damage * (0.8 + Math.random() * 0.4));

          setShield((s) => {
            let rem = damage;
            let newS = s;
            if (s > 0) {
              const abs = Math.min(s, rem);
              newS -= abs;
              rem -= abs;
            }
            if (rem > 0) {
              setHealth((h) => {
                const newH = Math.max(0, h - rem);
                sounds.playHurt();
                if (newH <= 0) {
                  // Player died to bot
                  setMyDeaths((d) => d + 1);
                  setKillFeed((kf) => [
                    ...kf,
                    {
                      id: 'kf_' + Math.random(),
                      killerName: bot.name,
                      victimName: localPlayerName,
                      weapon: cfg.name,
                      headshot: false,
                      timestamp: Date.now(),
                    },
                  ]);
                  // Respawn after 3s
                  setTimeout(() => {
                    const sp = arena.spawnPoints[Math.floor(Math.random() * arena.spawnPoints.length)];
                    fps.position.copy(sp);
                    setHealth(100);
                    setShield(50);
                  }, 3000);
                }
                return newH;
              });
            }
            return newS;
          });
        }
      }
    };

    // 7. FPS Shoot callback (Local player fires weapon)
    fps.onShoot = (origin, direction, weapon) => {
      const cfg = WEAPONS[weapon];

      // Send to server
      if (networkClientRef.current) {
        networkClientRef.current.sendShoot(
          { x: origin.x, y: origin.y, z: origin.z },
          { x: direction.x, y: direction.y, z: direction.z },
          weapon
        );
      }

      // Check pellets (1 for rifle/railgun, 8 for shotgun)
      const pellets = cfg.pellets;
      for (let p = 0; p < pellets; p++) {
        const spreadDir = direction.clone();
        if (cfg.spread > 0) {
          spreadDir.x += (Math.random() - 0.5) * cfg.spread;
          spreadDir.y += (Math.random() - 0.5) * cfg.spread;
          spreadDir.z += (Math.random() - 0.5) * cfg.spread;
          spreadDir.normalize();
        }

        _raycaster.set(origin, spreadDir);
        _raycaster.far = cfg.range;

        // Trace line endpoint
        let hitPoint = origin.clone().addScaledVector(spreadDir, cfg.range);
        let hitNormal = new THREE.Vector3(0, 1, 0);
        let hasHit = false;

        // Check Remote Players
        remotePlayersRef.current.forEach(({ mesh, target }) => {
          if (target.health <= 0) return;
          const hits = _raycaster.intersectObject(mesh, true);
          if (hits.length > 0 && hits[0].distance < origin.distanceTo(hitPoint)) {
            hitPoint = hits[0].point;
            hitNormal = hits[0].face?.normal || hitNormal;
            hasHit = true;

            // Headshot calculation
            const isHeadshot = hitPoint.y > mesh.position.y + 1.45;
            const dmg = isHeadshot ? cfg.damage * 2 : cfg.damage;

            // Audio & UI feedback
            if (isHeadshot) sounds.playHeadshot();
            else sounds.playHit();
            setHitMarkerActive(true);
            setTimeout(() => setHitMarkerActive(false), 80);
            spawnDamageNumber(hitPoint, dmg, isHeadshot);

            // Report hit to server
            if (networkClientRef.current) {
              networkClientRef.current.sendHit(target.id, dmg, weapon, isHeadshot);
            }
          }
        });

        // Check AI Bots
        if (botManagerRef.current) {
          for (const bot of botManagerRef.current.bots) {
            if (bot.player.health <= 0) continue;
            const hits = _raycaster.intersectObject(bot.mesh, true);
            if (hits.length > 0 && hits[0].distance < origin.distanceTo(hitPoint)) {
              hitPoint = hits[0].point;
              hitNormal = hits[0].face?.normal || hitNormal;
              hasHit = true;

              const isHeadshot = hitPoint.y > bot.mesh.position.y + 1.45;
              const dmg = isHeadshot ? cfg.damage * 2 : cfg.damage;

              if (isHeadshot) sounds.playHeadshot();
              else sounds.playHit();
              setHitMarkerActive(true);
              setTimeout(() => setHitMarkerActive(false), 80);
              spawnDamageNumber(hitPoint, dmg, isHeadshot);

              const result = botManagerRef.current.damageBot(bot.player.id, dmg, localPlayerName);
              if (result.killed) {
                sounds.playKill();
                setMyKills((k) => k + 1);
                setKillFeed((kf) => [
                  ...kf,
                  {
                    id: 'kf_' + Math.random(),
                    killerName: localPlayerName,
                    victimName: bot.player.name,
                    weapon: cfg.name,
                    headshot: isHeadshot,
                    timestamp: Date.now(),
                  },
                ]);
              }
              break;
            }
          }
        }

        // Spawn tracer & impact sparks
        spawnTracer(origin, hitPoint, cfg.id === 'railgun' ? 0xff0055 : cfg.id === 'shotgun' ? 0xffaa00 : 0x00f0ff);
        if (hasHit) {
          spawnImpactSparks(hitPoint, hitNormal, cfg.color);
        }
      }
    };

    // Weapon swap callback
    fps.onWeaponChange = (newW) => {
      setCurrentWeapon(newW);
      setAmmo(fps.ammo[newW]);

      // Swap 3D FPS weapon model
      if (fpsWeaponMeshRef.current && cameraRef.current) {
        cameraRef.current.remove(fpsWeaponMeshRef.current);
      }
      const newWeaponMesh = createFirstPersonWeapon(newW);
      camera.add(newWeaponMesh);
      fpsWeaponMeshRef.current = newWeaponMesh;
    };

    // Mount initial first person weapon model
    const initialWeapon = createFirstPersonWeapon('rifle');
    camera.add(initialWeapon);
    fpsWeaponMeshRef.current = initialWeapon;

    // Handle Window Resize
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth || window.innerWidth;
      const h = mountRef.current.clientHeight || window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Tab key listener for live scoreboard
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setIsScoreboardOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 8. Main Render & Simulation Loop (60FPS)
    const animate = (time: number) => {
      animFrameId.current = requestAnimationFrame(animate);

      const rawDt = (time - lastTimeRef.current) * 0.001;
      lastTimeRef.current = time;
      const dt = Math.min(rawDt, 0.05);

      // A. Arena procedural animations (pickups rotation, jump pad arrows)
      if (arenaDataRef.current) {
        arenaDataRef.current.animatedObjects.forEach((fn) => fn(dt));
      }

      // B. If in Title Screen: Cinematic camera orbit
      if (gameState === 'title') {
        const orbitRadius = 42;
        const orbitSpeed = time * 0.0003;
        camera.position.x = Math.sin(orbitSpeed) * orbitRadius;
        camera.position.z = Math.cos(orbitSpeed) * orbitRadius;
        camera.position.y = 14 + Math.sin(time * 0.0008) * 3;
        camera.lookAt(0, 4, 0);
      } else {
        // C. In Playing State: Update FPS Controller
        if (fpsControllerRef.current && arenaDataRef.current) {
          fpsControllerRef.current.update(dt, arenaDataRef.current.colliders);

          if (fpsWeaponMeshRef.current) {
            fpsControllerRef.current.updateWeaponTransform(fpsWeaponMeshRef.current);
          }

          // Sync local player mesh in third person
          if (localPlayerMeshRef.current) {
            localPlayerMeshRef.current.position.copy(fpsControllerRef.current.position);
            localPlayerMeshRef.current.rotation.y = fpsControllerRef.current.yaw;
            localPlayerMeshRef.current.visible = fpsControllerRef.current.isThirdPerson;
          }

          // Send state to network server
          if (networkClientRef.current) {
            networkClientRef.current.sendState(
              fpsControllerRef.current.position.x,
              fpsControllerRef.current.position.y,
              fpsControllerRef.current.position.z,
              fpsControllerRef.current.yaw,
              fpsControllerRef.current.pitch,
              fpsControllerRef.current.input?.shoot || false,
              !fpsControllerRef.current.isGrounded,
              fpsControllerRef.current.isCrouching,
              fpsControllerRef.current.currentWeapon
            );
          }

          // Check Pickup Collisions
          arenaDataRef.current.pickupMeshes.forEach((mesh, id) => {
            if (!mesh.visible) return;
            const dist = fpsControllerRef.current!.position.distanceTo(mesh.position);
            if (dist < 2.0) {
              if (id.includes('hp') && health < 100) {
                setHealth((h) => Math.min(100, h + 40));
                sounds.playPickup('health');
                mesh.visible = false;
                setTimeout(() => {
                  mesh.visible = true;
                }, 15000);
                if (networkClientRef.current) networkClientRef.current.sendCollectPickup(id);
              } else if (id.includes('shield') && shield < 100) {
                setShield((s) => Math.min(100, s + 50));
                sounds.playPickup('shield');
                mesh.visible = false;
                setTimeout(() => {
                  mesh.visible = true;
                }, 15000);
                if (networkClientRef.current) networkClientRef.current.sendCollectPickup(id);
              } else if (id.includes('ammo')) {
                // Restore all ammo
                fpsControllerRef.current!.ammo.rifle = WEAPONS.rifle.magazineSize;
                fpsControllerRef.current!.ammo.shotgun = WEAPONS.shotgun.magazineSize;
                fpsControllerRef.current!.ammo.railgun = WEAPONS.railgun.magazineSize;
                setAmmo(fpsControllerRef.current!.ammo[currentWeapon]);
                sounds.playPickup('ammo');
                mesh.visible = false;
                setTimeout(() => {
                  mesh.visible = true;
                }, 15000);
                if (networkClientRef.current) networkClientRef.current.sendCollectPickup(id);
              }
            }
          });

          // Sync HUD status periodically
          setAmmo(fpsControllerRef.current.ammo[fpsControllerRef.current.currentWeapon]);
          setIsReloading(fpsControllerRef.current.isReloading);
          setReloadProgress(fpsControllerRef.current.reloadProgress);
          setIsAiming(fpsControllerRef.current.isAiming);
        }

        // D. Update AI Bots
        if (botManagerRef.current && fpsControllerRef.current && arenaDataRef.current) {
          botManagerRef.current.update(
            dt,
            fpsControllerRef.current.position,
            health,
            Array.from(remotePlayersRef.current.values()).map((v) => v.target),
            arenaDataRef.current.colliders
          );
        }

        // E. Smoothly Interpolate Remote Players
        remotePlayersRef.current.forEach(({ mesh, target }) => {
          mesh.position.x = THREE.MathUtils.damp(mesh.position.x, target.x, 18, dt);
          mesh.position.y = THREE.MathUtils.damp(mesh.position.y, target.y, 18, dt);
          mesh.position.z = THREE.MathUtils.damp(mesh.position.z, target.z, 18, dt);
          mesh.rotation.y = THREE.MathUtils.damp(mesh.rotation.y, target.rotY, 16, dt);
        });
      }

      // F. Update Bullet Tracers (fade out)
      for (let i = tracersRef.current.length - 1; i >= 0; i--) {
        const tracer = tracersRef.current[i];
        tracer.life -= dt;
        if (tracer.life <= 0) {
          sceneRef.current?.remove(tracer.mesh);
          tracersRef.current.splice(i, 1);
        } else {
          ((tracer.mesh as THREE.Line).material as THREE.LineBasicMaterial).opacity = tracer.life / tracer.maxLife;
        }
      }

      // G. Update Spark Particles
      if (sparksMeshRef.current) {
        const matrix = new THREE.Matrix4();
        let activeCount = 0;

        for (let i = sparksRef.current.length - 1; i >= 0; i--) {
          const sp = sparksRef.current[i];
          sp.life -= dt;
          if (sp.life <= 0) {
            sparksRef.current.splice(i, 1);
          } else {
            sp.pos.addScaledVector(sp.vel, dt);
            sp.vel.y -= 9.8 * dt; // gravity

            if (activeCount < 150) {
              matrix.makeTranslation(sp.pos.x, sp.pos.y, sp.pos.z);
              sparksMeshRef.current.setMatrixAt(activeCount, matrix);
              activeCount++;
            }
          }
        }
        sparksMeshRef.current.count = activeCount;
        sparksMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // H. Render Scene
      if (sceneRef.current) {
        renderer.render(sceneRef.current, camera);
      }
    };

    animFrameId.current = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      sounds.stopAmbient();
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Initialize Network Connection when Game Starts
  const handleStartGame = (config: {
    roomId: string;
    playerName: string;
    playerColor: string;
    isSoloPractice: boolean;
  }) => {
    setRoomId(config.roomId);
    setLocalPlayerName(config.playerName);
    setLocalPlayerColor(config.playerColor);
    setIsSoloPractice(config.isSoloPractice);

    // Spawn 3D local player mesh (used when in 3rd person)
    if (sceneRef.current) {
      if (localPlayerMeshRef.current) {
        sceneRef.current.remove(localPlayerMeshRef.current);
      }
      const pMesh = createPlayerCharacterModel(config.playerColor, config.playerName);
      pMesh.visible = false;
      sceneRef.current.add(pMesh);
      localPlayerMeshRef.current = pMesh;
    }

    // Set starting position at an arena spawn point
    if (fpsControllerRef.current && arenaDataRef.current) {
      const sp = arenaDataRef.current.spawnPoints[Math.floor(Math.random() * arenaDataRef.current.spawnPoints.length)];
      fpsControllerRef.current.position.copy(sp);
      fpsControllerRef.current.yaw = Math.random() * Math.PI * 2;
    }

    // Reset health & stats
    setHealth(100);
    setShield(50);
    setMyKills(0);
    setMyDeaths(0);

    // Start background ambient synth hum
    sounds.startAmbient();

    if (config.isSoloPractice) {
      // In Solo Practice: Spawn 4 AI bots immediately
      if (botManagerRef.current) {
        botManagerRef.current.removeBots();
        botManagerRef.current.addBot(4);
      }
      setPlayerCount(5);
      setGameState('playing');
    } else {
      // In Multiplayer Mabar: Connect to WebSocket Server
      const client = new GameNetworkClient({
        onInit: (yourId, room, existingPlayers, pickups) => {
          setLocalPlayerId(yourId);
          setRoomId(room);

          // Clear previous remote players
          remotePlayersRef.current.forEach(({ mesh }) => sceneRef.current?.remove(mesh));
          remotePlayersRef.current.clear();

          // Add existing players
          existingPlayers.forEach((p) => {
            if (sceneRef.current) {
              const mesh = createPlayerCharacterModel(p.color, p.name);
              mesh.position.set(p.x, p.y, p.z);
              sceneRef.current.add(mesh);
              remotePlayersRef.current.set(p.id, { mesh, target: p });
            }
          });

          // Sync Pickups
          if (arenaDataRef.current) {
            pickups.forEach((pu) => {
              const mesh = arenaDataRef.current?.pickupMeshes.get(pu.id);
              if (mesh) mesh.visible = pu.active;
            });
          }

          setPlayerCount(remotePlayersRef.current.size + 1);
        },

        onPlayerJoined: (player) => {
          if (sceneRef.current && player.id !== localPlayerId) {
            const mesh = createPlayerCharacterModel(player.color, player.name);
            mesh.position.set(player.x, player.y, player.z);
            sceneRef.current.add(mesh);
            remotePlayersRef.current.set(player.id, { mesh, target: player });
            setPlayerCount(remotePlayersRef.current.size + 1);
          }
        },

        onPlayerMoved: (data) => {
          const entry = remotePlayersRef.current.get(data.id);
          if (entry) {
            Object.assign(entry.target, data);
          }
        },

        onPlayerShot: ({ shooterId, origin, direction, weapon }) => {
          const from = new THREE.Vector3(origin.x, origin.y, origin.z);
          const dir = new THREE.Vector3(direction.x, direction.y, direction.z);
          spawnTracer(from, from.clone().addScaledVector(dir, 45), 0x00f0ff);
          sounds.playShoot(weapon);
        },

        onPlayerDamaged: ({ targetId, damage, health: newH, shield: newS, headshot }) => {
          if (targetId === localPlayerId) {
            setHealth(newH);
            setShield(newS);
            sounds.playHurt();
          } else {
            const entry = remotePlayersRef.current.get(targetId);
            if (entry) {
              entry.target.health = newH;
              entry.target.shield = newS;
              const updateFn = (entry.mesh as unknown as { updateHP?: (hp: number, s: number) => void }).updateHP;
              if (updateFn) updateFn(newH, newS);
            }
          }
        },

        onPlayerKilled: ({ victimId, victimName, killerId, killerName, weapon, headshot, scores }) => {
          // Play fanfare if local player got kill
          if (killerId === localPlayerId) {
            sounds.playKill();
            setMyKills((k) => k + 1);
          } else if (victimId === localPlayerId) {
            sounds.playHurt();
            setMyDeaths((d) => d + 1);
          }

          // Add to kill feed
          setKillFeed((prev) => [
            ...prev,
            {
              id: 'kf_' + Math.random(),
              killerName,
              victimName,
              weapon,
              headshot,
              timestamp: Date.now(),
            },
          ]);

          // Hide victim mesh until respawn
          const victim = remotePlayersRef.current.get(victimId);
          if (victim) {
            victim.mesh.visible = false;
          }
        },

        onPlayerRespawned: ({ id, x, y, z, health: h, shield: s }) => {
          if (id === localPlayerId) {
            if (fpsControllerRef.current) {
              fpsControllerRef.current.position.set(x, y, z);
            }
            setHealth(h);
            setShield(s);
          } else {
            const entry = remotePlayersRef.current.get(id);
            if (entry) {
              entry.mesh.position.set(x, y, z);
              entry.mesh.visible = true;
              entry.target.health = h;
              entry.target.shield = s;
            }
          }
        },

        onPickupCollected: ({ pickupId }) => {
          const mesh = arenaDataRef.current?.pickupMeshes.get(pickupId);
          if (mesh) mesh.visible = false;
        },

        onPickupRespawned: ({ pickupId }) => {
          const mesh = arenaDataRef.current?.pickupMeshes.get(pickupId);
          if (mesh) mesh.visible = true;
        },

        onChatMessage: (msg) => {
          setChatMessages((prev) => [...prev.slice(-15), msg]);
        },

        onPlayerLeft: (id) => {
          const entry = remotePlayersRef.current.get(id);
          if (entry && sceneRef.current) {
            sceneRef.current.remove(entry.mesh);
            remotePlayersRef.current.delete(id);
            setPlayerCount(remotePlayersRef.current.size + 1);
          }
        },

        onPing: (p) => setPing(p),
        onConnectionChange: () => {},
      });

      client.connect(config.roomId, config.playerName, config.playerColor);
      networkClientRef.current = client;

      // Add 2 bots automatically into the arena for target practice while friends join
      if (botManagerRef.current) {
        botManagerRef.current.removeBots();
        botManagerRef.current.addBot(2);
      }

      setGameState('playing');
    }
  };

  const handleToggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const handleExitGame = () => {
    if (networkClientRef.current) {
      networkClientRef.current.disconnect();
    }
    if (botManagerRef.current) {
      botManagerRef.current.removeBots();
    }
    sounds.stopAmbient();
    setGameState('title');
  };

  const handleAddBot = () => {
    if (botManagerRef.current) {
      botManagerRef.current.addBot(1);
      setPlayerCount((p) => p + 1);
      sounds.playReload();
    }
  };

  const handleSendChat = (text: string) => {
    if (networkClientRef.current) {
      networkClientRef.current.sendChat(text);
    }
    // Also add to local chat view
    setChatMessages((prev) => [
      ...prev.slice(-15),
      {
        id: 'chat_' + Math.random(),
        senderName: localPlayerName,
        senderColor: localPlayerColor,
        text,
        timestamp: Date.now(),
      },
    ]);
  };

  // Build combined player list for Scoreboard modal
  useEffect(() => {
    const list: NetworkPlayer[] = [
      {
        id: localPlayerId,
        name: localPlayerName,
        color: localPlayerColor,
        x: fpsControllerRef.current?.position.x || 0,
        y: fpsControllerRef.current?.position.y || 0,
        z: fpsControllerRef.current?.position.z || 0,
        rotY: 0,
        pitch: 0,
        isShooting: false,
        isJumping: false,
        isCrouching: false,
        weapon: currentWeapon,
        health,
        shield,
        kills: myKills,
        deaths: myDeaths,
      },
    ];

    remotePlayersRef.current.forEach(({ target }) => list.push(target));

    if (botManagerRef.current) {
      botManagerRef.current.bots.forEach((b) => list.push(b.player));
    }

    setAllPlayersList(list);
  }, [localPlayerId, localPlayerName, localPlayerColor, currentWeapon, health, shield, myKills, myDeaths]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none">
      {/* 1. Dedicated WebGL Canvas Container (Isolated Ref) */}
      <div ref={mountRef} className="absolute inset-0 z-0 w-full h-full cursor-crosshair" />

      {/* 2. Red Damage Vignette Flash when taking damage */}
      {health < 100 && (
        <div
          className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300"
          style={{
            boxShadow: `inset 0 0 ${100 - health}px rgba(255, 0, 40, ${((100 - health) / 100) * 0.45})`,
          }}
        />
      )}

      {/* 3. Title Screen / Game Shell State */}
      {gameState === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* 4. In-Game Low-Occlusion HUD */}
      {gameState === 'playing' && (
        <>
          <GameHUD
            health={health}
            maxHealth={100}
            shield={shield}
            maxShield={100}
            currentWeapon={currentWeapon}
            ammo={ammo}
            maxAmmo={WEAPONS[currentWeapon].magazineSize}
            isReloading={isReloading}
            reloadProgress={reloadProgress}
            isAiming={isAiming}
            roomId={roomId}
            ping={ping}
            playerCount={playerCount}
            killFeed={killFeed}
            chatMessages={chatMessages}
            damageNumbers={damageNumbers}
            hitMarkerActive={hitMarkerActive}
            isThirdPerson={isThirdPerson}
            isMuted={isMuted}
            mouseSensitivity={mouseSensitivity}
            onWeaponSelect={(w) => fpsControllerRef.current?.switchWeapon(w)}
            onToggleThirdPerson={() => {
              setIsThirdPerson((prev) => !prev);
              if (fpsControllerRef.current) fpsControllerRef.current.isThirdPerson = !isThirdPerson;
            }}
            onToggleMute={handleToggleMute}
            onChangeSensitivity={(val) => {
              setMouseSensitivity(val);
              if (fpsControllerRef.current) fpsControllerRef.current.mouseSensitivity = val;
            }}
            onAddBot={handleAddBot}
            onSendChat={handleSendChat}
            onExitGame={handleExitGame}
          />

          {/* Mobile / Tablet On-Screen Touch Controls */}
          <TouchControls
            onMove={(dx, dy) => {
              if (fpsControllerRef.current) {
                fpsControllerRef.current.input.left = dx < -0.3;
                fpsControllerRef.current.input.right = dx > 0.3;
                fpsControllerRef.current.input.forward = dy < -0.3;
                fpsControllerRef.current.input.backward = dy > 0.3;
              }
            }}
            onLook={(dx, dy) => {
              if (fpsControllerRef.current) {
                fpsControllerRef.current.yaw -= dx * 15;
                fpsControllerRef.current.pitch -= dy * 15;
                fpsControllerRef.current.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, fpsControllerRef.current.pitch));
              }
            }}
            onShootStart={() => {
              if (fpsControllerRef.current) {
                fpsControllerRef.current.input.shoot = true;
                fpsControllerRef.current.fireCurrentWeapon();
              }
            }}
            onShootEnd={() => {
              if (fpsControllerRef.current) {
                fpsControllerRef.current.input.shoot = false;
              }
            }}
            onJump={() => {
              if (fpsControllerRef.current && fpsControllerRef.current.isGrounded) {
                fpsControllerRef.current.velocity.y = 10.5;
                fpsControllerRef.current.isGrounded = false;
                sounds.playJump();
              }
            }}
            onReload={() => fpsControllerRef.current?.startReload()}
            onToggleThirdPerson={() => {
              setIsThirdPerson((prev) => !prev);
              if (fpsControllerRef.current) fpsControllerRef.current.isThirdPerson = !isThirdPerson;
            }}
            onWeaponSelect={(w) => fpsControllerRef.current?.switchWeapon(w)}
            currentWeapon={currentWeapon}
          />

          {/* Live Scoreboard Modal (Tab Key) */}
          <ScoreboardModal
            isOpen={isScoreboardOpen}
            onClose={() => setIsScoreboardOpen(false)}
            players={allPlayersList}
            localPlayerId={localPlayerId}
            roomId={roomId}
            matchKills={myKills}
            matchDeaths={myDeaths}
          />
        </>
      )}
    </div>
  );
}
