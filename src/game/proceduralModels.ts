import * as THREE from 'three';
import { WeaponType } from '../types/game';

// Helper for procedural canvas textures
export function createTechGridTexture(color = '#00f0ff', bgColor = '#0b0f19', size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  // Outer border
  ctx.strokeStyle = '#182438';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  // Grid lines
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.lineWidth = 1;
  const step = size / 8;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Tech accent corners & dots
  ctx.fillStyle = color;
  const dotSize = 4;
  for (let x = step; x < size; x += step) {
    for (let y = step; y < size; y += step) {
      ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
    }
  }

  // Accent bolt rivets
  ctx.fillStyle = '#2a3b5c';
  const inset = 16;
  ctx.beginPath();
  ctx.arc(inset, inset, 5, 0, Math.PI * 2);
  ctx.arc(size - inset, inset, 5, 0, Math.PI * 2);
  ctx.arc(inset, size - inset, 5, 0, Math.PI * 2);
  ctx.arc(size - inset, size - inset, 5, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Crate texture with hazard stripes
export function createHazardCrateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1c2230';
  ctx.fillRect(0, 0, 512, 512);

  // Metal panel inset
  ctx.fillStyle = '#141824';
  ctx.fillRect(20, 20, 472, 472);

  // Hazard diagonal stripe bar in center
  ctx.save();
  ctx.beginPath();
  ctx.rect(30, 220, 452, 70);
  ctx.clip();
  ctx.fillStyle = '#181b22';
  ctx.fillRect(30, 220, 452, 70);

  ctx.fillStyle = '#ffb700';
  for (let x = -100; x < 600; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 220);
    ctx.lineTo(x + 25, 220);
    ctx.lineTo(x - 15, 290);
    ctx.lineTo(x - 40, 290);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Sci-fi stencil text
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TACTICAL SUPPLY // UNIT-07', 256, 180);

  // Tech border
  ctx.strokeStyle = '#2b3952';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 492);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Player Character Model: Composite 3-12 part procedural model
export function createPlayerCharacterModel(playerColor = '#00f0ff', playerName = 'Soldier'): THREE.Group {
  const root = new THREE.Group();
  root.name = 'player_character';

  const teamColor = new THREE.Color(playerColor);
  const armorDark = new THREE.Color('#121620');
  const armorTrim = new THREE.Color('#222c3d');

  // Materials
  const armorMat = new THREE.MeshStandardMaterial({
    color: armorDark,
    roughness: 0.35,
    metalness: 0.8,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.2,
    metalness: 0.6,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: armorTrim,
    roughness: 0.5,
    metalness: 0.5,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    emissive: teamColor,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.9,
  });

  // 1. Pelvis / Tactical Belt (Y: 0.8)
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.35), trimMat);
  pelvis.position.y = 0.85;
  root.add(pelvis);

  // 2. Torso Chest Armor (Primary Silhouette) (Y: 1.15)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 1.15;

  const chestChassis = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.42), armorMat);
  torsoGroup.add(chestChassis);

  // Chest plate accent
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.1), accentMat);
  chestPlate.position.set(0, 0.05, 0.2);
  torsoGroup.add(chestPlate);

  // Power Core (Glowing reactor)
  const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), visorMat);
  reactor.rotation.x = Math.PI / 2;
  reactor.position.set(0, 0.05, 0.25);
  torsoGroup.add(reactor);

  // 3. Jet Thruster Pack on Back
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.22), trimMat);
  backpack.position.set(0, 0.05, -0.25);
  torsoGroup.add(backpack);

  const nozzleGeom = new THREE.CylinderGeometry(0.07, 0.1, 0.2, 12);
  const leftNozzle = new THREE.Mesh(nozzleGeom, visorMat);
  leftNozzle.position.set(-0.15, -0.22, -0.26);
  torsoGroup.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(nozzleGeom, visorMat);
  rightNozzle.position.set(0.15, -0.22, -0.26);
  torsoGroup.add(rightNozzle);

  root.add(torsoGroup);

  // 4. Cyber Helmet / Head (Secondary Read) (Y: 1.62)
  const headGroup = new THREE.Group();
  headGroup.name = 'player_head';
  headGroup.position.y = 1.62;

  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.44), armorMat);
  headGroup.add(helmet);

  // Helmet side cheek plates
  const leftPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.35), trimMat);
  leftPlate.position.set(-0.22, -0.05, 0);
  headGroup.add(leftPlate);

  const rightPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.35), trimMat);
  rightPlate.position.set(0.22, -0.05, 0);
  headGroup.add(rightPlate);

  // Visor (Accent detail)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.1), visorMat);
  visor.position.set(0, 0.05, 0.22);
  headGroup.add(visor);

  // Tactical Antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), accentMat);
  antenna.position.set(-0.22, 0.25, -0.1);
  headGroup.add(antenna);

  root.add(headGroup);

  // 5. Shoulder Pauldrons
  const leftShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.3), accentMat);
  leftShoulder.position.set(-0.46, 1.35, 0);
  root.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.3), accentMat);
  rightShoulder.position.set(0.46, 1.35, 0);
  root.add(rightShoulder);

  // 6. Arms & Held Blaster
  const armGeom = new THREE.BoxGeometry(0.15, 0.5, 0.16);
  const leftArm = new THREE.Mesh(armGeom, trimMat);
  leftArm.position.set(-0.44, 1.0, 0.15);
  leftArm.rotation.x = -Math.PI / 6;
  root.add(leftArm);

  const rightArm = new THREE.Mesh(armGeom, trimMat);
  rightArm.position.set(0.44, 1.0, 0.2);
  rightArm.rotation.x = -Math.PI / 4;
  root.add(rightArm);

  // Blaster in hands
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0.2, 1.05, 0.45);
  gunGroup.rotation.y = -0.1;

  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.6), trimMat);
  gunGroup.add(gunBody);

  const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 12), armorMat);
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.02, 0.4);
  gunGroup.add(gunBarrel);

  const gunEmitter = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), visorMat);
  gunEmitter.rotation.x = Math.PI / 2;
  gunEmitter.position.set(0, 0.02, 0.63);
  gunGroup.add(gunEmitter);

  root.add(gunGroup);

  // 7. Legs & Boots (Pivoted at ground)
  const legGeom = new THREE.BoxGeometry(0.2, 0.72, 0.22);
  const leftLeg = new THREE.Mesh(legGeom, trimMat);
  leftLeg.position.set(-0.18, 0.4, 0);
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeom, trimMat);
  rightLeg.position.set(0.18, 0.4, 0);
  root.add(rightLeg);

  const bootGeom = new THREE.BoxGeometry(0.22, 0.16, 0.32);
  const leftBoot = new THREE.Mesh(bootGeom, armorMat);
  leftBoot.position.set(-0.18, 0.08, 0.05);
  root.add(leftBoot);

  const rightBoot = new THREE.Mesh(bootGeom, armorMat);
  rightBoot.position.set(0.18, 0.08, 0.05);
  root.add(rightBoot);

  // 8. Overhead Name & Health billboard canvas
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const updateBillboard = (hp: number, shield: number) => {
    ctx.clearRect(0, 0, 256, 64);

    // Name tag
    ctx.fillStyle = playerColor;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(playerName, 128, 24);

    // Background bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(28, 36, 200, 14);

    // Shield bar
    const shieldWidth = Math.max(0, (shield / 100) * 196);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(30, 38, shieldWidth, 4);

    // Health bar
    const hpWidth = Math.max(0, (hp / 100) * 196);
    ctx.fillStyle = hp > 30 ? '#00ff66' : '#ff0044';
    ctx.fillRect(30, 44, hpWidth, 4);

    tagTexture.needsUpdate = true;
  };

  const tagTexture = new THREE.CanvasTexture(canvas);
  tagTexture.colorSpace = THREE.SRGBColorSpace;
  const tagMat = new THREE.SpriteMaterial({ map: tagTexture, depthTest: false });
  const nameSprite = new THREE.Sprite(tagMat);
  nameSprite.position.set(0, 2.2, 0);
  nameSprite.scale.set(1.5, 0.375, 1);
  nameSprite.name = 'player_nametag';
  root.add(nameSprite);

  updateBillboard(100, 50);

  // Expose update methods
  (root as unknown as { updateHP: (hp: number, shield: number) => void }).updateHP = updateBillboard;

  // Contact shadow under feet
  const shadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.02;
  root.add(shadowMesh);

  return root;
}

// First-Person View Weapon Model attached to camera
export function createFirstPersonWeapon(weapon: WeaponType): THREE.Group {
  const root = new THREE.Group();
  root.name = 'fps_weapon';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x181c24,
    roughness: 0.3,
    metalness: 0.85,
  });

  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x2d3748,
    roughness: 0.7,
    metalness: 0.2,
  });

  const neonColor = weapon === 'rifle' ? 0x00f0ff : weapon === 'shotgun' ? 0xffaa00 : 0xff0055;
  const neonMat = new THREE.MeshStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 0.9,
    roughness: 0.1,
  });

  if (weapon === 'rifle') {
    // Pulse Rifle
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.65), bodyMat);
    root.add(mainBody);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 16), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.45);
    root.add(barrel);

    // Glowing energy conduit
    const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.35), neonMat);
    conduit.position.set(0, 0.05, -0.15);
    root.add(conduit);

    // Holographic Sight
    const sightPost = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.08), bodyMat);
    sightPost.position.set(0, 0.09, 0.05);
    root.add(sightPost);

    const sightGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), neonMat);
    sightGlass.position.set(0, 0.1, 0.05);
    root.add(sightGlass);

    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), gripMat);
    mag.position.set(0, -0.12, 0.05);
    mag.rotation.x = 0.2;
    root.add(mag);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.08), gripMat);
    grip.position.set(0, -0.12, 0.22);
    grip.rotation.x = -0.3;
    root.add(grip);
  } else if (weapon === 'shotgun') {
    // Heavy Scattergun
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.55), bodyMat);
    root.add(mainBody);

    // Twin Barrels
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 16), bodyMat);
    b1.rotation.x = Math.PI / 2;
    b1.position.set(-0.03, 0.02, -0.4);
    root.add(b1);

    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 16), bodyMat);
    b2.rotation.x = Math.PI / 2;
    b2.position.set(0.03, 0.02, -0.4);
    root.add(b2);

    // Pump slide
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.18, 16), neonMat);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, -0.01, -0.25);
    root.add(pump);

    // Stock & Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), gripMat);
    grip.position.set(0, -0.12, 0.2);
    grip.rotation.x = -0.35;
    root.add(grip);
  } else {
    // Vortex Railgun
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.8), bodyMat);
    root.add(mainBody);

    // Long accelerator barrel
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.6), neonMat);
    rail1.position.set(-0.04, 0.02, -0.6);
    root.add(rail1);

    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.6), neonMat);
    rail2.position.set(0.04, 0.02, -0.6);
    root.add(rail2);

    // Accelerator rings
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16), neonMat);
      ring.position.set(0, 0.02, -0.4 - i * 0.14);
      root.add(ring);
    }

    // Heavy Sniper Scope
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 16), bodyMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.12, 0.02);
    root.add(scope);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.08), gripMat);
    grip.position.set(0, -0.12, 0.25);
    grip.rotation.x = -0.3;
    root.add(grip);
  }

  // Muzzle flash mesh (normally invisible, flashes on fire)
  const flashGeom = new THREE.OctahedronGeometry(0.09, 1);
  const flashMat = new THREE.MeshBasicMaterial({
    color: neonColor,
    transparent: true,
    opacity: 0,
  });
  const muzzleFlash = new THREE.Mesh(flashGeom, flashMat);
  muzzleFlash.position.set(0, 0.02, -0.7);
  muzzleFlash.name = 'muzzle_flash';
  root.add(muzzleFlash);

  // Position in FPS lower right
  root.position.set(0.24, -0.22, -0.42);

  return root;
}

// Pickup Stations: Floating rotating holographic item
export function createPickupStation(type: 'health' | 'shield' | 'ammo'): THREE.Group {
  const root = new THREE.Group();
  root.name = `pickup_${type}`;

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x161a24,
    roughness: 0.4,
    metalness: 0.8,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.2, 16), baseMat);
  base.position.y = 0.1;
  root.add(base);

  const glowColor = type === 'health' ? 0x00ff66 : type === 'shield' ? 0x00f0ff : 0xffaa00;
  const neonMat = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity: 1.2,
    roughness: 0.1,
    metalness: 0.7,
  });

  // Glowing base ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 8, 24), neonMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.21;
  root.add(ring);

  // Floating core group (animated in render loop)
  const coreGroup = new THREE.Group();
  coreGroup.name = 'core_group';
  coreGroup.position.y = 1.0;

  if (type === 'health') {
    // 3D Med Cross
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.18), neonMat);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), neonMat);
    coreGroup.add(cross1);
    coreGroup.add(cross2);
  } else if (type === 'shield') {
    // Octahedron energy crystal
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), neonMat);
    coreGroup.add(crystal);

    const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.02, 8, 24), neonMat);
    orbitRing.rotation.x = Math.PI / 4;
    coreGroup.add(orbitRing);
  } else {
    // Ammo battery container
    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.45, 12), neonMat);
    coreGroup.add(canister);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), baseMat);
    topCap.position.y = 0.25;
    coreGroup.add(topCap);
  }

  root.add(coreGroup);

  return root;
}

// Jump Pad: Launches player vertically into the air
export function createJumpPad(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'jump_pad';

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x0f131c,
    roughness: 0.35,
    metalness: 0.85,
  });

  const energyMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.5,
    roughness: 0.1,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.25, 8), baseMat);
  base.position.y = 0.125;
  root.add(base);

  const innerDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.28, 16), energyMat);
  innerDisc.position.y = 0.13;
  root.add(innerDisc);

  // Chevron directional arrows
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 4), energyMat);
  arrow.position.set(0, 0.6, 0);
  arrow.name = 'jump_arrow';
  root.add(arrow);

  return root;
}

// Sci-Fi Cover Barricade / Crate
export function createSciFiCrate(width = 2.4, height = 1.8, depth = 1.6): THREE.Group {
  const root = new THREE.Group();
  root.name = 'cover_crate';

  const texture = createHazardCrateTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.4,
    metalness: 0.65,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x222a38,
    roughness: 0.3,
    metalness: 0.8,
  });

  const mainBox = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mainBox.position.y = height / 2;
  root.add(mainBox);

  // Corner protective brackets
  const cornerGeom = new THREE.BoxGeometry(0.25, height + 0.02, 0.25);
  [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [-width / 2, depth / 2],
    [width / 2, depth / 2],
  ].forEach(([x, z]) => {
    const corner = new THREE.Mesh(cornerGeom, frameMat);
    corner.position.set(x, height / 2, z);
    root.add(corner);
  });

  return root;
}
