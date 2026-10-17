import * as THREE from 'three';
import { CollisionBox } from './arena';
import { WeaponType, WEAPONS } from '../types/game';
import { sounds } from '../audio/soundEffects';

export interface PlayerInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  shoot: boolean;
  aim: boolean;
}

export class FPSController {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public isLocked: boolean = false;
  public isThirdPerson: boolean = false;

  // Transform
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.8, 20);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public yaw: number = 0;
  public pitch: number = 0;

  // Weapon recoil & sway
  public recoilPitch: number = 0;
  public recoilYaw: number = 0;
  public weaponSway: THREE.Vector2 = new THREE.Vector2();
  public bobTimer: number = 0;

  // State
  public isGrounded: boolean = false;
  public isCrouching: boolean = false;
  public isAiming: boolean = false;
  public currentWeapon: WeaponType = 'rifle';
  public ammo: Record<WeaponType, number> = {
    rifle: WEAPONS.rifle.magazineSize,
    shotgun: WEAPONS.shotgun.magazineSize,
    railgun: WEAPONS.railgun.magazineSize,
  };
  public isReloading: boolean = false;
  public reloadProgress: number = 0;
  public lastFireTime: number = 0;

  // Settings
  public mouseSensitivity: number = 0.0022;
  private readonly PLAYER_HEIGHT = 1.75;
  private readonly CROUCH_HEIGHT = 1.1;
  private readonly PLAYER_RADIUS = 0.45;

  public input: PlayerInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    crouch: false,
    shoot: false,
    aim: false,
  };

  // Callbacks
  public onShoot?: (origin: THREE.Vector3, direction: THREE.Vector3, weapon: WeaponType) => void;
  public onWeaponChange?: (weapon: WeaponType) => void;
  public onJumpPadLaunch?: () => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.bindEvents();
  }

  private bindEvents() {
    // Pointer lock
    this.domElement.addEventListener('click', () => {
      if (!this.isLocked) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      const deltaX = e.movementX * this.mouseSensitivity;
      const deltaY = e.movementY * this.mouseSensitivity;

      this.yaw -= deltaX;
      this.pitch -= deltaY;
      // Clamp pitch to avoid neck breaking
      this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));

      // Weapon sway
      this.weaponSway.x += deltaX * 0.04;
      this.weaponSway.y += deltaY * 0.04;
    });

    // Mouse buttons
    document.addEventListener('mousedown', (e) => {
      if (!this.isLocked) return;
      if (e.button === 0) {
        this.input.shoot = true;
      } else if (e.button === 2) {
        this.input.aim = true;
        this.isAiming = true;
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.input.shoot = false;
      } else if (e.button === 2) {
        this.input.aim = false;
        this.isAiming = false;
      }
    });

    // Prevent context menu on right click
    document.addEventListener('contextmenu', (e) => {
      if (this.isLocked) e.preventDefault();
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (!this.isLocked) return;
      this.handleKeyDown(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.handleKeyUp(e.code);
    });

    // Clear held keys on blur
    window.addEventListener('blur', () => {
      this.resetInput();
    });
  }

  private handleKeyDown(code: string) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = true;
        break;
      case 'Space':
        this.input.jump = true;
        if (this.isGrounded) {
          this.velocity.y = 10.5;
          this.isGrounded = false;
          sounds.playJump();
        }
        break;
      case 'KeyC':
      case 'ShiftLeft':
        this.input.crouch = true;
        this.isCrouching = true;
        break;
      case 'KeyR':
        this.startReload();
        break;
      case 'Digit1':
        this.switchWeapon('rifle');
        break;
      case 'Digit2':
        this.switchWeapon('shotgun');
        break;
      case 'Digit3':
        this.switchWeapon('railgun');
        break;
      case 'KeyV':
        this.isThirdPerson = !this.isThirdPerson;
        break;
    }
  }

  private handleKeyUp(code: string) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = false;
        break;
      case 'Space':
        this.input.jump = false;
        break;
      case 'KeyC':
      case 'ShiftLeft':
        this.input.crouch = false;
        this.isCrouching = false;
        break;
    }
  }

  public resetInput() {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.jump = false;
    this.input.crouch = false;
    this.input.shoot = false;
    this.input.aim = false;
    this.isAiming = false;
  }

  public switchWeapon(weapon: WeaponType) {
    if (this.currentWeapon === weapon || this.isReloading) return;
    this.currentWeapon = weapon;
    sounds.playReload();
    if (this.onWeaponChange) this.onWeaponChange(weapon);
  }

  public startReload() {
    const config = WEAPONS[this.currentWeapon];
    if (this.isReloading || this.ammo[this.currentWeapon] >= config.magazineSize) return;

    this.isReloading = true;
    this.reloadProgress = 0;
    sounds.playReload();
  }

  public fireCurrentWeapon(): boolean {
    if (this.isReloading) return false;

    const config = WEAPONS[this.currentWeapon];
    const now = performance.now();
    const interval = 1000 / config.fireRate;

    if (now - this.lastFireTime < interval) return false;
    this.lastFireTime = now;

    if (this.ammo[this.currentWeapon] <= 0) {
      sounds.playEmpty();
      this.startReload();
      return false;
    }

    // Spend ammo
    this.ammo[this.currentWeapon]--;

    // Recoil kick
    this.recoilPitch += config.id === 'railgun' ? 0.08 : config.id === 'shotgun' ? 0.06 : 0.025;
    this.recoilYaw += (Math.random() - 0.5) * 0.015;

    // Play procedural sound
    sounds.playShoot(this.currentWeapon);

    // Calculate bullet origin and forward vector
    const shootDirection = new THREE.Vector3(0, 0, -1);
    shootDirection.applyEuler(new THREE.Euler(this.pitch + this.recoilPitch, this.yaw + this.recoilYaw, 0, 'YXZ'));

    // In First Person: bullet originates right at camera eye
    const origin = this.position.clone();
    origin.y += (this.isCrouching ? this.CROUCH_HEIGHT : this.PLAYER_HEIGHT) - 0.15;

    if (this.onShoot) {
      this.onShoot(origin, shootDirection, this.currentWeapon);
    }

    return true;
  }

  public update(dt: number, colliders: CollisionBox[]) {
    // Clamp delta time for stable simulation
    const clampedDt = Math.min(dt, 0.05);

    // 1. Reloading logic
    if (this.isReloading) {
      const config = WEAPONS[this.currentWeapon];
      this.reloadProgress += clampedDt / config.reloadTime;
      if (this.reloadProgress >= 1) {
        this.ammo[this.currentWeapon] = config.magazineSize;
        this.isReloading = false;
        this.reloadProgress = 0;
      }
    }

    // 2. Continuous shooting (pulse rifle)
    if (this.input.shoot && this.isLocked) {
      this.fireCurrentWeapon();
    }

    // 3. Movement vector based on yaw
    const moveDir = new THREE.Vector3();
    if (this.input.forward) moveDir.z -= 1;
    if (this.input.backward) moveDir.z += 1;
    if (this.input.left) moveDir.x -= 1;
    if (this.input.right) moveDir.x += 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    }

    // Speed calculation
    const baseSpeed = this.isCrouching ? 6.0 : this.isAiming ? 8.5 : 14.0;
    const accel = this.isGrounded ? 80.0 : 25.0;

    // Target horizontal velocity
    const targetVx = moveDir.x * baseSpeed;
    const targetVz = moveDir.z * baseSpeed;

    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVx, accel * 0.15, clampedDt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetVz, accel * 0.15, clampedDt);

    // Gravity
    this.velocity.y -= 28.0 * clampedDt;

    // Movement stepping & collisions
    const currentHeight = this.isCrouching ? this.CROUCH_HEIGHT : this.PLAYER_HEIGHT;
    const nextPos = this.position.clone().addScaledVector(this.velocity, clampedDt);

    // Collision detection with arena boxes
    this.isGrounded = false;

    // Check jump pads and platforms
    for (const box of colliders) {
      // Check Jump Pad trigger
      if (box.jumpPad) {
        if (
          nextPos.x >= box.min.x &&
          nextPos.x <= box.max.x &&
          nextPos.z >= box.min.z &&
          nextPos.z <= box.max.z &&
          this.position.y >= box.min.y &&
          this.position.y <= box.max.y + 1.5
        ) {
          // Launch upward!
          this.velocity.y = 23.0;
          this.isGrounded = false;
          sounds.playJumpPad();
          if (this.onJumpPadLaunch) this.onJumpPadLaunch();
          continue;
        }
      }

      // Vertical platform top landing
      const isOverX = nextPos.x + this.PLAYER_RADIUS > box.min.x && nextPos.x - this.PLAYER_RADIUS < box.max.x;
      const isOverZ = nextPos.z + this.PLAYER_RADIUS > box.min.z && nextPos.z - this.PLAYER_RADIUS < box.max.z;

      if (isOverX && isOverZ) {
        // Landing on top surface
        if (this.position.y >= box.max.y - 0.4 && nextPos.y <= box.max.y + 0.1 && this.velocity.y <= 0) {
          nextPos.y = box.max.y;
          this.velocity.y = 0;
          this.isGrounded = true;
        }
      }

      // Horizontal Wall push-back
      const isOverY = nextPos.y < box.max.y && nextPos.y + currentHeight > box.min.y;
      if (isOverY && !box.jumpPad) {
        if (isOverZ) {
          if (this.position.x <= box.min.x && nextPos.x + this.PLAYER_RADIUS > box.min.x) {
            nextPos.x = box.min.x - this.PLAYER_RADIUS;
            this.velocity.x = 0;
          } else if (this.position.x >= box.max.x && nextPos.x - this.PLAYER_RADIUS < box.max.x) {
            nextPos.x = box.max.x + this.PLAYER_RADIUS;
            this.velocity.x = 0;
          }
        }
        if (isOverX) {
          if (this.position.z <= box.min.z && nextPos.z + this.PLAYER_RADIUS > box.min.z) {
            nextPos.z = box.min.z - this.PLAYER_RADIUS;
            this.velocity.z = 0;
          } else if (this.position.z >= box.max.z && nextPos.z - this.PLAYER_RADIUS < box.max.z) {
            nextPos.z = box.max.z + this.PLAYER_RADIUS;
            this.velocity.z = 0;
          }
        }
      }
    }

    // Arena Floor collision (Y = 0)
    if (nextPos.y <= 0) {
      nextPos.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Boundary perimeter clamping
    nextPos.x = Math.max(-46, Math.min(46, nextPos.x));
    nextPos.z = Math.max(-46, Math.min(46, nextPos.z));

    this.position.copy(nextPos);

    // Recoil recovery
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 18, clampedDt);
    this.recoilYaw = THREE.MathUtils.damp(this.recoilYaw, 0, 18, clampedDt);

    // Weapon sway recovery
    this.weaponSway.x = THREE.MathUtils.damp(this.weaponSway.x, 0, 12, clampedDt);
    this.weaponSway.y = THREE.MathUtils.damp(this.weaponSway.y, 0, 12, clampedDt);

    // Head bobbing while moving
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 1 && this.isGrounded) {
      this.bobTimer += clampedDt * speed * 1.5;
    } else {
      this.bobTimer = THREE.MathUtils.damp(this.bobTimer, 0, 8, clampedDt);
    }
    const bobOffset = Math.sin(this.bobTimer) * 0.04;

    // Camera Positioning
    const eyeHeight = currentHeight + bobOffset;
    const totalPitch = this.pitch + this.recoilPitch;
    const totalYaw = this.yaw + this.recoilYaw;

    if (!this.isThirdPerson) {
      // First Person: Camera is at eye position
      this.camera.position.set(this.position.x, this.position.y + eyeHeight, this.position.z);
      this.camera.rotation.set(totalPitch, totalYaw, 0, 'YXZ');
    } else {
      // Third Person: Camera behind player over shoulder
      const backDist = 3.2;
      const shoulderX = 0.6;
      const camOffset = new THREE.Vector3(shoulderX, 0.4, backDist);
      camOffset.applyEuler(new THREE.Euler(totalPitch, totalYaw, 0, 'YXZ'));

      this.camera.position.set(
        this.position.x + camOffset.x,
        this.position.y + eyeHeight + camOffset.y,
        this.position.z + camOffset.z
      );
      this.camera.rotation.set(totalPitch, totalYaw, 0, 'YXZ');
    }

    // Dynamic FOV zoom for ADS
    const targetFov = this.isAiming ? (this.currentWeapon === 'railgun' ? 32 : 55) : 75;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, clampedDt);
    this.camera.updateProjectionMatrix();
  }

  // Update attached first person weapon position and bob
  public updateWeaponTransform(weaponMesh: THREE.Group) {
    if (this.isThirdPerson) {
      weaponMesh.visible = false;
      return;
    }
    weaponMesh.visible = true;

    // ADS target offset (center in screen when aiming)
    const adsTargetX = this.isAiming ? 0 : 0.22;
    const adsTargetY = this.isAiming ? -0.16 : -0.22;
    const adsTargetZ = this.isAiming ? -0.32 : -0.42;

    const bobX = Math.cos(this.bobTimer * 0.5) * 0.015;
    const bobY = Math.abs(Math.sin(this.bobTimer)) * 0.018;

    weaponMesh.position.x = adsTargetX - this.weaponSway.x * 0.5 + bobX;
    weaponMesh.position.y = adsTargetY - this.weaponSway.y * 0.5 - bobY;
    weaponMesh.position.z = adsTargetZ;

    weaponMesh.rotation.y = this.weaponSway.x * 1.5;
    weaponMesh.rotation.x = this.weaponSway.y * 1.5;
  }
}
