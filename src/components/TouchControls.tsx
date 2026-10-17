import React, { useRef, useState, useEffect } from 'react';
import { Target, ArrowUp, RefreshCw, Eye } from 'lucide-react';
import { WeaponType } from '../types/game';

interface TouchControlsProps {
  onMove: (dx: number, dy: number) => void;
  onLook: (dx: number, dy: number) => void;
  onShootStart: () => void;
  onShootEnd: () => void;
  onJump: () => void;
  onReload: () => void;
  onToggleThirdPerson: () => void;
  onWeaponSelect: (w: WeaponType) => void;
  currentWeapon: WeaponType;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMove,
  onLook,
  onShootStart,
  onShootEnd,
  onJump,
  onReload,
  onToggleThirdPerson,
  onWeaponSelect,
  currentWeapon,
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [isDraggingJoy, setIsDraggingJoy] = useState(false);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const lastLookTouch = useRef<{ id: number; x: number; y: number } | null>(null);

  // Handle virtual joystick
  const handleJoyStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;
    touchStartPos.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setIsDraggingJoy(true);
  };

  const handleJoyMove = (e: React.TouchEvent) => {
    if (!isDraggingJoy) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 45;

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const posX = Math.cos(angle) * clampedDist;
    const posY = Math.sin(angle) * clampedDist;

    setStickPos({ x: posX, y: posY });
    onMove(posX / maxRadius, posY / maxRadius);
  };

  const handleJoyEnd = () => {
    setIsDraggingJoy(false);
    setStickPos({ x: 0, y: 0 });
    onMove(0, 0);
  };

  // Handle right-side touch look swipe
  const handleLookTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX > window.innerWidth / 2) {
        lastLookTouch.current = { id: t.identifier, x: t.clientX, y: t.clientY };
        break;
      }
    }
  };

  const handleLookTouchMove = (e: React.TouchEvent) => {
    if (!lastLookTouch.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lastLookTouch.current.id) {
        const dx = (t.clientX - lastLookTouch.current.x) * 0.005;
        const dy = (t.clientY - lastLookTouch.current.y) * 0.005;
        onLook(dx, dy);
        lastLookTouch.current = { id: t.identifier, x: t.clientX, y: t.clientY };
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent) => {
    if (!lastLookTouch.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lastLookTouch.current.id) {
        lastLookTouch.current = null;
        break;
      }
    }
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none z-30 select-none sm:hidden"
      onTouchStart={handleLookTouchStart}
      onTouchMove={handleLookTouchMove}
      onTouchEnd={handleLookTouchEnd}
      onTouchCancel={handleLookTouchEnd}
    >
      {/* Virtual Joystick (Bottom Left) */}
      <div
        ref={joystickRef}
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
        onTouchCancel={handleJoyEnd}
        className="absolute bottom-6 left-6 w-32 h-32 rounded-full bg-slate-900/40 border border-cyan-500/30 flex items-center justify-center pointer-events-auto"
      >
        <div
          className="w-12 h-12 rounded-full bg-cyan-500/70 border border-white shadow-lg pointer-events-none"
          style={{ transform: `translate(${stickPos.x}px, ${stickPos.y}px)` }}
        />
      </div>

      {/* Action Buttons (Bottom Right) */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 pointer-events-auto">
        {/* Weapon switcher */}
        <div className="flex gap-1.5 mb-1">
          {(['rifle', 'shotgun', 'railgun'] as WeaponType[]).map((w) => (
            <button
              key={w}
              onTouchStart={() => onWeaponSelect(w)}
              className={`px-2 py-1 text-[10px] font-mono rounded ${
                currentWeapon === w ? 'bg-cyan-500 text-black font-bold' : 'bg-slate-900/80 text-white'
              }`}
            >
              {w.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Third Person Toggle */}
          <button
            onTouchStart={onToggleThirdPerson}
            className="w-11 h-11 rounded-full bg-slate-800/80 text-slate-300 flex items-center justify-center text-xs"
          >
            <Eye size={18} />
          </button>

          {/* Reload Button */}
          <button
            onTouchStart={onReload}
            className="w-11 h-11 rounded-full bg-slate-800/80 text-amber-400 flex items-center justify-center text-xs"
          >
            <RefreshCw size={18} />
          </button>

          {/* Jump Button */}
          <button
            onTouchStart={onJump}
            className="w-12 h-12 rounded-full bg-cyan-600/80 text-black font-bold flex items-center justify-center shadow-lg"
          >
            <ArrowUp size={22} />
          </button>
        </div>

        {/* Primary Shoot Button */}
        <button
          onTouchStart={onShootStart}
          onTouchEnd={onShootEnd}
          className="w-18 h-18 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 text-white font-black flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.4)] active:scale-95"
        >
          <Target size={30} />
        </button>
      </div>
    </div>
  );
};
