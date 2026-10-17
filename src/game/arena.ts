import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createTechGridTexture,
  createSciFiCrate,
  createPickupStation,
  createJumpPad,
} from './proceduralModels';

export interface CollisionBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
  jumpPad?: boolean;
}

export interface ArenaData {
  scene: THREE.Scene;
  colliders: CollisionBox[];
  pickupMeshes: Map<string, THREE.Group>;
  jumpPads: Array<{ x: number; y: number; z: number; mesh: THREE.Group }>;
  animatedObjects: Array<(dt: number) => void>;
  spawnPoints: Array<THREE.Vector3>;
}

export function buildTacticalArena(renderer: THREE.WebGLRenderer): ArenaData {
  const scene = new THREE.Scene();

  // Cyberpunk dark atmospheric horizon fog
  scene.background = new THREE.Color('#060911');
  scene.fog = new THREE.FogExp2('#060911', 0.014);

  // Procedural Studio Environment for realistic PBR reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremGenerator.dispose();

  // 1. Lighting Rig
  // Key Light (Warm cybernetic sun)
  const dirLight = new THREE.DirectionalLight('#ffe5b4', 1.8);
  dirLight.position.set(40, 60, 30);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 10;
  dirLight.shadow.camera.far = 160;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.bias = -0.0005;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);

  // Cool Hemisphere Light
  const hemiLight = new THREE.HemisphereLight('#00e5ff', '#2d124d', 0.85);
  scene.add(hemiLight);

  // Subtle ambient fill
  const ambLight = new THREE.AmbientLight('#121b2d', 0.4);
  scene.add(ambLight);

  const colliders: CollisionBox[] = [];
  const animatedObjects: Array<(dt: number) => void> = [];
  const pickupMeshes = new Map<string, THREE.Group>();
  const jumpPads: Array<{ x: number; y: number; z: number; mesh: THREE.Group }> = [];

  const addCollider = (box: THREE.Box3, isJumpPad = false) => {
    colliders.push({
      min: box.min.clone(),
      max: box.max.clone(),
      jumpPad: isJumpPad,
    });
  };

  // 2. Main Arena Floor (96x96 meters)
  const floorTexture = createTechGridTexture('#00f0ff', '#0a0d16', 512);
  floorTexture.repeat.set(24, 24);

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.4,
    metalness: 0.6,
  });

  const floorGeo = new THREE.PlaneGeometry(96, 96);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Beyond playable perimeter: natural/tech outer terrain ground extending to 240m
  const outerTexture = createTechGridTexture('#1a2638', '#04060a', 256);
  outerTexture.repeat.set(40, 40);
  const outerMat = new THREE.MeshStandardMaterial({
    map: outerTexture,
    roughness: 0.9,
    metalness: 0.2,
  });
  const outerFloor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), outerMat);
  outerFloor.rotation.x = -Math.PI / 2;
  outerFloor.position.y = -0.05;
  scene.add(outerFloor);

  // Perimeter Walls / Energy Boundary (at ±48m)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x111624,
    roughness: 0.5,
    metalness: 0.8,
  });

  const wallHoloMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.2,
    wireframe: true,
  });

  // Perimeter bounding boxes
  [
    { pos: [0, 5, -48], size: [96, 10, 2] },
    { pos: [0, 5, 48], size: [96, 10, 2] },
    { pos: [-48, 5, 0], size: [2, 10, 96] },
    { pos: [48, 5, 0], size: [2, 10, 96] },
  ].forEach(({ pos, size }) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), wallMat);
    wall.position.set(pos[0], pos[1], pos[2]);
    scene.add(wall);

    const holo = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), wallHoloMat);
    holo.position.set(pos[0], pos[1], pos[2]);
    scene.add(holo);

    addCollider(new THREE.Box3().setFromObject(wall));
  });

  // Perimeter boundary pillars with glowing beacon strips
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1c2436, roughness: 0.3, metalness: 0.9 });
  const pylonGlowMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.5,
  });

  for (let x = -48; x <= 48; x += 16) {
    [-48, 48].forEach((z) => {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12, 1.4), pylonMat);
      pylon.position.set(x, 6, z);
      scene.add(pylon);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 10, 1.5), pylonGlowMat);
      strip.position.set(x, 6, z);
      scene.add(strip);
    });
  }
  for (let z = -48; z <= 48; z += 16) {
    [-48, 48].forEach((x) => {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12, 1.4), pylonMat);
      pylon.position.set(x, 6, z);
      scene.add(pylon);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 10, 0.2), pylonGlowMat);
      strip.position.set(x, 6, z);
      scene.add(strip);
    });
  }

  // 3. Central Mega Tower (Octagonal elevated platform, height 6m)
  const platformMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.35,
    metalness: 0.7,
  });

  // Tower Base Column
  const centerBase = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 6, 8), pylonMat);
  centerBase.position.set(0, 3, 0);
  scene.add(centerBase);
  addCollider(new THREE.Box3().setFromObject(centerBase));

  // Tower Top Deck
  const centerTop = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 0.6, 8), platformMat);
  centerTop.position.set(0, 6.3, 0);
  scene.add(centerTop);
  addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 6.3, 0), new THREE.Vector3(18, 0.6, 18)));

  // Center glowing energy column
  const coreBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.7,
    })
  );
  coreBeam.position.set(0, 14, 0);
  scene.add(coreBeam);

  // 4. North & South Ramps accessing the center tower
  [
    { pos: [0, 3, -16], rotY: 0 },
    { pos: [0, 3, 16], rotY: Math.PI },
  ].forEach(({ pos, rotY }) => {
    const rampGroup = new THREE.Group();
    rampGroup.position.set(pos[0], 0, pos[2]);
    rampGroup.rotation.y = rotY;

    // Angled slope
    const rampGeo = new THREE.BoxGeometry(4.5, 0.4, 15);
    const ramp = new THREE.Mesh(rampGeo, platformMat);
    ramp.rotation.x = Math.atan2(6.3, 15); // angle up to 6.3m
    ramp.position.set(0, 3.15, 0);
    rampGroup.add(ramp);
    scene.add(rampGroup);

    // Approximate stepped colliders for smooth slope walking
    for (let step = 0; step < 6; step++) {
      const stepY = (step + 0.5) * 1.05;
      const stepZ = -6.5 + step * 2.5;
      const worldZ = rotY === 0 ? pos[2] + stepZ : pos[2] - stepZ;
      addCollider(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(pos[0], stepY, worldZ),
          new THREE.Vector3(4.8, 1.1, 2.8)
        )
      );
    }
  });

  // 5. 4 Corner Elevated Platforms (Sniper Decks, height 3.5m)
  const cornerCoords = [
    { x: -26, z: -26 },
    { x: 26, z: -26 },
    { x: -26, z: 26 },
    { x: 26, z: 26 },
  ];

  cornerCoords.forEach(({ x, z }) => {
    // 4 Support Pillars
    for (let dx of [-4, 4]) {
      for (let dz of [-4, 4]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.5, 0.8), pylonMat);
        pillar.position.set(x + dx, 1.75, z + dz);
        scene.add(pillar);
      }
    }

    // Platform deck (10 x 10m)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), platformMat);
    deck.position.set(x, 3.5, z);
    scene.add(deck);
    addCollider(new THREE.Box3().setFromObject(deck));

    // Railing around corners
    const railMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.6 });
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.9, 0.15), railMat);
    rail1.position.set(x, 4.2, z + (z < 0 ? -5 : 5));
    scene.add(rail1);
    addCollider(new THREE.Box3().setFromObject(rail1));

    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 10), railMat);
    rail2.position.set(x + (x < 0 ? -5 : 5), 4.2, z);
    scene.add(rail2);
    addCollider(new THREE.Box3().setFromObject(rail2));
  });

  // 6. Connecting Aerial Catwalks / Bridges between East-West platforms
  [
    { start: [-26, 3.5, -26], end: [26, 3.5, -26], len: 42, horizontal: true },
    { start: [-26, 3.5, 26], end: [26, 3.5, 26], len: 42, horizontal: true },
  ].forEach(({ start, end, len }) => {
    const midX = (start[0] + end[0]) / 2;
    const midZ = (start[2] + end[2]) / 2;

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, 3.2), platformMat);
    bridge.position.set(midX, 3.5, midZ);
    scene.add(bridge);
    addCollider(new THREE.Box3().setFromObject(bridge));
  });

  // 7. Tactical Sci-Fi Cover Barricades & Crates
  const cratePositions = [
    // Near center
    { x: -10, z: -10, rot: 0.2 },
    { x: 10, z: -10, rot: -0.3 },
    { x: -10, z: 10, rot: -0.4 },
    { x: 10, z: 10, rot: 0.5 },
    // Outer perimeter covers
    { x: -32, z: 0, rot: 0 },
    { x: 32, z: 0, rot: 0 },
    { x: 0, z: -32, rot: Math.PI / 2 },
    { x: 0, z: 32, rot: Math.PI / 2 },
    // Upper deck crates
    { x: -24, z: -24, y: 3.75, rot: 0.4 },
    { x: 24, z: 24, y: 3.75, rot: -0.2 },
    // Center tower cover
    { x: 4, z: 4, y: 6.6, rot: 0.7 },
    { x: -4, z: -4, y: 6.6, rot: -0.5 },
  ];

  cratePositions.forEach(({ x, z, y = 0, rot }) => {
    const crate = createSciFiCrate(2.6, 1.8, 1.8);
    crate.position.set(x, y, z);
    crate.rotation.y = rot;
    scene.add(crate);
    addCollider(new THREE.Box3().setFromObject(crate));
  });

  // 8. Jump Pads (4 tactical launch spots to fling players upward!)
  const jumpPadLocations = [
    { x: -16, y: 0, z: 0 },
    { x: 16, y: 0, z: 0 },
    { x: 0, y: 0, z: -22 },
    { x: 0, y: 0, z: 22 },
  ];

  jumpPadLocations.forEach(({ x, y, z }) => {
    const pad = createJumpPad();
    pad.position.set(x, y, z);
    scene.add(pad);
    jumpPads.push({ x, y, z, mesh: pad });

    // Collider trigger
    addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y + 0.3, z), new THREE.Vector3(2.5, 0.8, 2.5)), true);
  });

  // 9. Pickups (Health, Shield, Ammo)
  const pickupConfigs = [
    { id: 'hp_center', type: 'health' as const, x: 0, y: 6.6, z: 0 }, // Top of tower
    { id: 'shield_north', type: 'shield' as const, x: 0, y: 3.75, z: -26 }, // North aerial bridge
    { id: 'shield_south', type: 'shield' as const, x: 0, y: 3.75, z: 26 }, // South aerial bridge
    { id: 'ammo_west', type: 'ammo' as const, x: -28, y: 0, z: 0 }, // West ground lane
    { id: 'ammo_east', type: 'ammo' as const, x: 28, y: 0, z: 0 }, // East ground lane
    { id: 'hp_top_tower', type: 'health' as const, x: 0, y: 0, z: -8 }, // Center ground entrance
  ];

  pickupConfigs.forEach((cfg) => {
    const station = createPickupStation(cfg.type);
    station.position.set(cfg.x, cfg.y, cfg.z);
    scene.add(station);
    pickupMeshes.set(cfg.id, station);
  });

  // Animation loop callback for spinning pickups & pulsing jump pads
  animatedObjects.push((dt) => {
    // Pickups rotation & bobbing
    pickupMeshes.forEach((mesh) => {
      const core = mesh.getObjectByName('core_group');
      if (core) {
        core.rotation.y += dt * 1.5;
        core.position.y = 1.0 + Math.sin(Date.now() * 0.003) * 0.12;
      }
    });

    // Jump pad arrows bobbing
    jumpPads.forEach(({ mesh }) => {
      const arrow = mesh.getObjectByName('jump_arrow');
      if (arrow) {
        arrow.rotation.y += dt * 2.0;
        arrow.position.y = 0.6 + Math.sin(Date.now() * 0.006) * 0.15;
      }
    });
  });

  // Balanced arena spawn points
  const spawnPoints = [
    new THREE.Vector3(-35, 1.5, -35),
    new THREE.Vector3(35, 1.5, -35),
    new THREE.Vector3(-35, 1.5, 35),
    new THREE.Vector3(35, 1.5, 35),
    new THREE.Vector3(-26, 4.8, -26),
    new THREE.Vector3(26, 4.8, 26),
    new THREE.Vector3(-30, 1.5, 0),
    new THREE.Vector3(30, 1.5, 0),
  ];

  return {
    scene,
    colliders,
    pickupMeshes,
    jumpPads,
    animatedObjects,
    spawnPoints,
  };
}
