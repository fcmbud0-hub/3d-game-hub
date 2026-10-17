export type WeaponType = 'rifle' | 'shotgun' | 'railgun';

export interface WeaponConfig {
  id: WeaponType;
  name: string;
  damage: number;
  fireRate: number; // rounds per second
  magazineSize: number;
  reloadTime: number; // seconds
  pellets: number;
  spread: number;
  range: number;
  color: string;
  description: string;
}

export const WEAPONS: Record<WeaponType, WeaponConfig> = {
  rifle: {
    id: 'rifle',
    name: 'Pulse Rifle MK-IV',
    damage: 22,
    fireRate: 8,
    magazineSize: 30,
    reloadTime: 1.8,
    pellets: 1,
    spread: 0.02,
    range: 120,
    color: '#00f0ff',
    description: 'Senapan serbu otomatis presisi tinggi',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Scattergun Helix',
    damage: 14, // 14 x 8 pellets = 112 max close dmg
    fireRate: 1.4,
    magazineSize: 8,
    reloadTime: 2.4,
    pellets: 8,
    spread: 0.08,
    range: 45,
    color: '#ffaa00',
    description: 'Daya hancur masif jarak dekat',
  },
  railgun: {
    id: 'railgun',
    name: 'Vortex Railgun',
    damage: 85,
    fireRate: 0.9,
    magazineSize: 5,
    reloadTime: 2.8,
    pellets: 1,
    spread: 0.002,
    range: 200,
    color: '#ff0055',
    description: 'Senapan energi kinetik jarak jauh berkekuatan tinggi',
  },
};

export interface NetworkPlayer {
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
  weapon: WeaponType;
  health: number;
  shield: number;
  kills: number;
  deaths: number;
  isBot?: boolean;
}

export interface PickupItem {
  id: string;
  type: 'health' | 'shield' | 'ammo';
  x: number;
  y: number;
  z: number;
  active: boolean;
  respawnAt?: number;
}

export interface KillEvent {
  id: string;
  killerName: string;
  killerColor?: string;
  victimName: string;
  victimColor?: string;
  weapon: string;
  headshot?: boolean;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
}

export interface DamageNumber {
  id: string;
  damage: number;
  x: number; // screen coordinate
  y: number;
  headshot: boolean;
  createdAt: number;
}
