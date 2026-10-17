import React, { useState } from 'react';
import {
  Heart,
  Shield,
  Zap,
  Volume2,
  VolumeX,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Crosshair,
  Eye,
  Sliders,
  LogOut,
  Radio,
  Send,
} from 'lucide-react';
import { WeaponType, WEAPONS, KillEvent, ChatMessage, DamageNumber } from '../types/game';

interface GameHUDProps {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  currentWeapon: WeaponType;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  isAiming: boolean;
  roomId: string;
  ping: number;
  playerCount: number;
  killFeed: KillEvent[];
  chatMessages: ChatMessage[];
  damageNumbers: DamageNumber[];
  hitMarkerActive: boolean;
  isThirdPerson: boolean;
  isMuted: boolean;
  mouseSensitivity: number;
  onWeaponSelect: (w: WeaponType) => void;
  onToggleThirdPerson: () => void;
  onToggleMute: () => void;
  onChangeSensitivity: (val: number) => void;
  onAddBot: () => void;
  onSendChat: (text: string) => void;
  onExitGame: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  health,
  maxHealth,
  shield,
  maxShield,
  currentWeapon,
  ammo,
  maxAmmo,
  isReloading,
  reloadProgress,
  isAiming,
  roomId,
  ping,
  playerCount,
  killFeed,
  chatMessages,
  damageNumbers,
  hitMarkerActive,
  isThirdPerson,
  isMuted,
  mouseSensitivity,
  onWeaponSelect,
  onToggleThirdPerson,
  onToggleMute,
  onChangeSensitivity,
  onAddBot,
  onSendChat,
  onExitGame,
}) => {
  const [copied, setCopied] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showChatBox, setShowChatBox] = useState(false);

  const weaponCfg = WEAPONS[currentWeapon];

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  const QUICK_TACTICS = ['Maju serang!', 'Musuh di menara atas!', 'Butuh medkit!', 'Cover aku!', 'GG Mantap!'];

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden flex flex-col justify-between p-4 sm:p-6 font-tech">
      {/* 1. Floating Damage Numbers */}
      {damageNumbers.map((dmg) => (
        <div
          key={dmg.id}
          className={`absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 font-black tabular-nums transition-all ${
            dmg.headshot
              ? 'text-yellow-300 text-2xl drop-shadow-[0_0_8px_rgba(255,255,0,0.8)]'
              : 'text-red-400 text-lg drop-shadow-[0_0_4px_rgba(255,0,0,0.8)]'
          }`}
          style={{
            left: `${dmg.x}px`,
            top: `${dmg.y - (performance.now() - dmg.createdAt) * 0.05}px`,
            opacity: Math.max(0, 1 - (performance.now() - dmg.createdAt) / 800),
          }}
        >
          {dmg.headshot ? `💥 CRIT -${dmg.damage}` : `-${dmg.damage}`}
        </div>
      ))}

      {/* 2. Top Perimeter Bar */}
      <div className="flex items-start justify-between w-full">
        {/* Top-Left: Room Code, Mabar Share, Ping & Player Count */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-2 bg-slate-950/85 border border-cyan-500/40 rounded px-3 py-1.5 shadow-lg">
            <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400">ROOM:</span>
            <span className="font-mono font-bold text-white tracking-widest text-sm">{roomId}</span>
            <button
              onClick={handleCopyLink}
              className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-800 text-xs font-mono transition-colors cursor-pointer"
              title="Salin Link Mabar"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/75 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {playerCount} Pemain
            </span>
            <span className="text-slate-600">|</span>
            <span className="tabular-nums text-cyan-400">{ping} ms</span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setShowChatBox(!showChatBox)}
              className="hover:text-cyan-400 transition-colors cursor-pointer text-[11px]"
            >
              💬 Chat Mabar
            </button>
          </div>
        </div>

        {/* Top-Right: Kill Feed */}
        <div className="flex flex-col items-end gap-1.5 max-w-xs pointer-events-none">
          {killFeed.slice(-4).map((kill) => (
            <div
              key={kill.id}
              className="flex items-center gap-2 px-2.5 py-1 rounded bg-black/80 border-r-2 border-r-cyan-400 border border-slate-800 text-xs tracking-wider animate-fadeIn"
            >
              <span className="font-bold text-cyan-400">{kill.killerName}</span>
              <span className="text-[10px] text-slate-400 px-1 py-0.5 bg-slate-900 rounded font-mono">
                {kill.weapon}
              </span>
              <span className="font-medium text-red-400">{kill.victimName}</span>
              {kill.headshot && <span className="text-[10px] text-yellow-400 font-black">CRIT!</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Center Tactical Crosshair with Hit Marker */}
      {!isThirdPerson && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {/* Dynamic Crosshair Bars */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* Center dot */}
            <div
              className={`w-1 h-1 rounded-full ${
                isAiming ? 'bg-cyan-400 scale-125' : 'bg-white/80'
              } transition-transform`}
            />

            {/* Reticle Lines */}
            <div
              className="absolute w-0.5 h-2.5 bg-cyan-400"
              style={{ top: isAiming ? '-6px' : '-11px' }}
            />
            <div
              className="absolute w-0.5 h-2.5 bg-cyan-400"
              style={{ bottom: isAiming ? '-6px' : '-11px' }}
            />
            <div
              className="absolute h-0.5 w-2.5 bg-cyan-400"
              style={{ left: isAiming ? '-6px' : '-11px' }}
            />
            <div
              className="absolute h-0.5 w-2.5 bg-cyan-400"
              style={{ right: isAiming ? '-6px' : '-11px' }}
            />

            {/* Hit Marker X Flash */}
            {hitMarkerActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-red-500 rotate-45 animate-ping opacity-90"></div>
                <div className="w-4 h-4 border border-yellow-400 rotate-45"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Tactical Chat Wheel / Popover */}
      {showChatBox && (
        <div className="absolute bottom-28 left-6 w-80 bg-slate-950/95 border border-cyan-500/50 rounded-md p-3 pointer-events-auto shadow-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-xs text-cyan-400 font-mono tracking-wider">KOMUNIKASI TAKTIS</span>
            <button
              onClick={() => setShowChatBox(false)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Quick presets */}
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_TACTICS.map((msg, i) => (
              <button
                key={i}
                onClick={() => {
                  onSendChat(msg);
                  setShowChatBox(false);
                }}
                className="px-2 py-1 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-left text-[11px] text-slate-200 rounded truncate cursor-pointer"
              >
                {msg}
              </button>
            ))}
          </div>

          {/* Custom text input */}
          <form onSubmit={handleSendChat} className="flex gap-1.5 mt-1">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Tulis pesan..."
              maxLength={60}
              className="flex-1 bg-black border border-slate-700 px-2.5 py-1 text-xs text-white rounded focus:outline-none focus:border-cyan-400 font-mono"
            />
            <button
              type="submit"
              className="p-1.5 bg-cyan-600 hover:bg-cyan-500 text-black rounded cursor-pointer"
            >
              <Send size={14} />
            </button>
          </form>

          {/* Recent Messages */}
          <div className="max-h-24 overflow-y-auto flex flex-col gap-1 text-[11px] font-mono mt-1 text-slate-400">
            {chatMessages.slice(-4).map((m) => (
              <div key={m.id} className="truncate">
                <span style={{ color: m.senderColor }} className="font-bold">
                  {m.senderName}:
                </span>{' '}
                <span className="text-slate-200">{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Bottom Perimeter Status Clusters & Unified Dock */}
      <div className="flex items-end justify-between w-full">
        {/* Bottom-Left: Health & Shield Readouts */}
        <div className="flex flex-col gap-2 bg-slate-950/85 border border-slate-800 rounded-lg p-3 min-w-[200px] shadow-2xl pointer-events-auto">
          {/* Health Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-red-400 uppercase font-mono tracking-wider">
                <Heart size={14} fill="currentColor" />
                HEALTH
              </span>
              <span className="tabular-nums font-bold text-sm text-white">
                {Math.round(health)} <span className="text-slate-500 text-xs">/ 100</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-xs overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-150 ${
                  health > 30 ? 'bg-gradient-to-r from-red-600 to-rose-400' : 'bg-red-600'
                }`}
                style={{ width: `${Math.max(0, (health / maxHealth) * 100)}%` }}
              />
            </div>
          </div>

          {/* Shield Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-cyan-400 uppercase font-mono tracking-wider">
                <Shield size={14} fill="currentColor" />
                SHIELD
              </span>
              <span className="tabular-nums font-bold text-sm text-cyan-200">
                {Math.round(shield)} <span className="text-slate-500 text-xs">/ 100</span>
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-xs overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-300 transition-all duration-150"
                style={{ width: `${Math.max(0, (shield / maxShield) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bottom-Center: Consolidated Tactical Dock (Three.js Skill Directive) */}
        <div className="hidden sm:flex flex-col items-center pointer-events-auto">
          {/* Collapse/Expand Toggle Button */}
          <button
            onClick={() => setDockExpanded(!dockExpanded)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-t-md bg-slate-950/80 border-t border-x border-slate-700 text-slate-300 hover:text-cyan-400 text-xs font-mono tracking-wider transition-colors cursor-pointer"
          >
            {dockExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            <span>{dockExpanded ? 'Sembunyikan Menu' : 'Opsi Kontrol'}</span>
          </button>

          {/* Dock Body */}
          <div
            className={`flex items-center gap-3 px-4 py-2 bg-slate-950/90 border border-slate-700/80 rounded-b-md shadow-2xl transition-all ${
              dockExpanded ? 'opacity-100 translate-y-0' : 'opacity-80'
            }`}
          >
            <button
              onClick={onToggleThirdPerson}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                isThirdPerson
                  ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/50'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
              title="Ganti Mode Kamera (V)"
            >
              <Eye size={14} />
              <span>{isThirdPerson ? 'Third Person' : 'FPS (Kamera 1)'}</span>
            </button>

            <button
              onClick={onAddBot}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-amber-400 text-xs transition-colors cursor-pointer"
              title="Tambah Musuh Bot AI"
            >
              <UserPlus size={14} />
              <span>+ Bot AI</span>
            </button>

            <button
              onClick={onToggleMute}
              className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
              title="Audio On/Off"
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pl-2 border-l border-slate-800">
              <Sliders size={13} />
              <input
                type="range"
                min="0.001"
                max="0.005"
                step="0.0005"
                value={mouseSensitivity}
                onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
                className="w-16 accent-cyan-400 cursor-pointer"
                title="Sensitivitas Mouse"
              />
            </div>

            <button
              onClick={onExitGame}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-950/60 border border-red-700/60 text-red-400 hover:bg-red-900/60 text-xs transition-colors cursor-pointer ml-1"
            >
              <LogOut size={13} />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* Bottom-Right: Active Weapon & Ammo Cluster */}
        <div className="flex flex-col items-end gap-2 bg-slate-950/85 border border-slate-800 rounded-lg p-3 min-w-[210px] shadow-2xl pointer-events-auto">
          {/* Weapon Switcher Icons */}
          <div className="flex items-center gap-1.5">
            {(['rifle', 'shotgun', 'railgun'] as WeaponType[]).map((w, idx) => (
              <button
                key={w}
                onClick={() => onWeaponSelect(w)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono tracking-wider transition-all cursor-pointer ${
                  currentWeapon === w
                    ? 'bg-cyan-500 text-black font-black'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                [{idx + 1}] {w === 'rifle' ? 'RIFLE' : w === 'shotgun' ? 'SHOTGUN' : 'RAILGUN'}
              </button>
            ))}
          </div>

          {/* Weapon Name & Ammo Count */}
          <div className="flex items-end justify-between w-full pt-1 border-t border-slate-800/80">
            <div>
              <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-widest">{weaponCfg.name}</div>
              <div className="text-[10px] text-slate-500 font-sans">{weaponCfg.description}</div>
            </div>

            <div className="flex items-baseline gap-1 text-right">
              {isReloading ? (
                <div className="flex items-center gap-1 text-amber-400 font-mono text-sm tracking-wider">
                  <span className="animate-spin">⚙</span>
                  <span>RELOAD ({Math.round(reloadProgress * 100)}%)</span>
                </div>
              ) : (
                <>
                  <span
                    className={`tabular-nums font-black text-2xl ${
                      ammo <= 5 ? 'text-red-400 animate-pulse' : 'text-white'
                    }`}
                  >
                    {ammo}
                  </span>
                  <span className="text-slate-500 font-mono text-xs">/ {maxAmmo}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
