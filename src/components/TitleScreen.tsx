import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Users, Swords, Play, Copy, Check, Shield, Crosshair } from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface TitleScreenProps {
  onStartGame: (config: {
    roomId: string;
    playerName: string;
    playerColor: string;
    isSoloPractice: boolean;
  }) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const COLOR_OPTIONS = [
  { name: 'Cyan Neon', hex: '#00f0ff' },
  { name: 'Pink Laser', hex: '#ff0077' },
  { name: 'Acid Green', hex: '#00ff66' },
  { name: 'Solar Amber', hex: '#ffaa00' },
  { name: 'Vortex Violet', hex: '#9933ff' },
  { name: 'Crimson Red', hex: '#ff2244' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStartGame, isMuted, onToggleMute }) => {
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('cyber_player_name') || `Prajurit_${Math.floor(100 + Math.random() * 900)}`;
  });
  const [selectedColor, setSelectedColor] = useState('#00f0ff');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [urlRoom, setUrlRoom] = useState<string | null>(null);

  // Check URL query param for instant mabar invite link (e.g. ?room=ROOM123)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setUrlRoom(roomParam.toUpperCase());
      setRoomCodeInput(roomParam.toUpperCase());
    }
  }, []);

  const handleQuickMatch = () => {
    const room = urlRoom || 'ARENA-1';
    localStorage.setItem('cyber_player_name', playerName);
    sounds.playHit();
    onStartGame({
      roomId: room,
      playerName: playerName.trim() || 'Soldier',
      playerColor: selectedColor,
      isSoloPractice: false,
    });
  };

  const handleCreatePrivateRoom = () => {
    // Generate 5-character cool tactical room code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MABAR-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    localStorage.setItem('cyber_player_name', playerName);
    sounds.playHit();
    onStartGame({
      roomId: code,
      playerName: playerName.trim() || 'Soldier',
      playerColor: selectedColor,
      isSoloPractice: false,
    });
  };

  const handleJoinWithCode = () => {
    if (!roomCodeInput.trim()) return;
    localStorage.setItem('cyber_player_name', playerName);
    sounds.playHit();
    onStartGame({
      roomId: roomCodeInput.trim().toUpperCase(),
      playerName: playerName.trim() || 'Soldier',
      playerColor: selectedColor,
      isSoloPractice: false,
    });
  };

  const handleSoloPractice = () => {
    localStorage.setItem('cyber_player_name', playerName);
    sounds.playHit();
    onStartGame({
      roomId: 'OFFLINE_SOLO',
      playerName: playerName.trim() || 'Soldier',
      playerColor: selectedColor,
      isSoloPractice: true,
    });
  };

  const copyShareLink = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('room', roomCodeInput || 'ARENA-1');
    navigator.clipboard.writeText(currentUrl.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-between p-6 sm:p-10 pointer-events-auto bg-gradient-to-b from-black/85 via-black/60 to-black/90 backdrop-blur-xs select-none">
      {/* Top Bar: Spec & Mute toggle */}
      <div className="w-full max-w-6xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs tracking-widest font-mono uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            v1.0 Sci-Fi Multiplayer
          </span>
          <span className="hidden sm:inline-block text-xs font-mono text-slate-400 tracking-wider">
            60FPS · Three.js PBR · Web Audio
          </span>
        </div>

        <button
          onClick={onToggleMute}
          className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors cursor-pointer"
          title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Main Center Stage: Bespoke Inline SVG Title Lockup */}
      <div className="w-full max-w-4xl flex flex-col items-center text-center my-auto py-4">
        {/* SVG Title Logo */}
        <div className="relative mb-2">
          <svg
            className="w-[320px] sm:w-[540px] md:w-[680px] h-auto drop-shadow-[0_0_35px_rgba(0,240,255,0.45)]"
            viewBox="0 0 700 130"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f0ff" />
                <stop offset="50%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#ff0077" />
              </linearGradient>
              <linearGradient id="subGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00f0ff" />
                <stop offset="100%" stopColor="#ffaa00" />
              </linearGradient>
            </defs>

            {/* Background grid accent */}
            <path d="M50 20 L650 20 L630 110 L70 110 Z" fill="#080f1d" fillOpacity="0.4" stroke="#00f0ff" strokeOpacity="0.2" strokeWidth="1.5" />

            {/* Outer tactical crosshairs */}
            <line x1="30" y1="65" x2="60" y2="65" stroke="#00f0ff" strokeWidth="2" />
            <line x1="640" y1="65" x2="670" y2="65" stroke="#ff0077" strokeWidth="2" />

            {/* Main Title Text */}
            <text
              x="350"
              y="74"
              textAnchor="middle"
              fontFamily="Chakra Petch, Impact, sans-serif"
              fontWeight="900"
              fontSize="62"
              fontStyle="italic"
              letterSpacing="6"
              fill="url(#cyberGrad)"
              stroke="#040914"
              strokeWidth="2"
            >
              CYBER ARENA 3D
            </text>

            {/* Subtitle banner */}
            <text
              x="350"
              y="102"
              textAnchor="middle"
              fontFamily="Rajdhani, sans-serif"
              fontWeight="700"
              fontSize="16"
              letterSpacing="9"
              fill="url(#subGrad)"
            >
              MULTIPLAYER TACTICAL MABAR
            </text>
          </svg>
        </div>

        <p className="text-slate-300 text-sm sm:text-base max-w-xl font-medium tracking-wide mb-6">
          Game tembak-tembakan 3D FPS real-time. Bagikan link atau kode room ke teman untuk mabar langsung di arena futuristik!
        </p>

        {/* Character Customization Box */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-700/80 rounded-md p-4 mb-6 shadow-2xl">
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-left text-xs font-mono text-cyan-400 uppercase tracking-widest mb-1.5">
                Nama Prajurit Anda
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.substring(0, 15))}
                placeholder="Masukkan Nickname..."
                maxLength={15}
                className="w-full px-3.5 py-2 bg-black/70 border border-slate-600 rounded text-slate-100 placeholder-slate-500 font-tech font-bold tracking-wider focus:outline-none focus:border-cyan-400 text-sm"
              />
            </div>

            <div>
              <label className="block text-left text-xs font-mono text-cyan-400 uppercase tracking-widest mb-1.5">
                Warna Visor & Baju Armor
              </label>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_OPTIONS.map((col) => (
                  <button
                    key={col.hex}
                    onClick={() => setSelectedColor(col.hex)}
                    style={{ backgroundColor: col.hex }}
                    className={`h-8 rounded transition-all cursor-pointer relative ${
                      selectedColor === col.hex ? 'ring-2 ring-white scale-105' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={col.name}
                  >
                    {selectedColor === col.hex && (
                      <span className="absolute inset-0 flex items-center justify-center text-black font-black text-xs">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
          {/* Quick Match / Mabar Cepat */}
          <button
            onClick={handleQuickMatch}
            className="group relative flex items-center justify-center gap-3 px-5 py-3.5 rounded bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-tech font-black tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.6)] cursor-pointer"
          >
            <Play size={18} fill="currentColor" />
            <span>Mabar Cepat {urlRoom ? `(${urlRoom})` : '(Publik)'}</span>
          </button>

          {/* Buat Room Khusus Mabar */}
          <button
            onClick={handleCreatePrivateRoom}
            className="group flex items-center justify-center gap-3 px-5 py-3.5 rounded bg-slate-900 border border-cyan-500/60 hover:bg-cyan-950/40 text-cyan-300 font-tech font-bold tracking-wider uppercase transition-all hover:border-cyan-400 cursor-pointer"
          >
            <Users size={18} />
            <span>Buat Room Mabar</span>
          </button>

          {/* Gabung Room Teman */}
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex items-center justify-center gap-3 px-5 py-3 rounded bg-slate-900/80 border border-slate-700 hover:border-slate-500 text-slate-200 font-tech font-bold tracking-wider uppercase transition-all cursor-pointer"
          >
            <Shield size={18} />
            <span>Gabung Kode Room</span>
          </button>

          {/* Latihan Solo / Bot */}
          <button
            onClick={handleSoloPractice}
            className="flex items-center justify-center gap-3 px-5 py-3 rounded bg-slate-900/80 border border-amber-600/50 hover:border-amber-400 text-amber-400 font-tech font-bold tracking-wider uppercase transition-all cursor-pointer"
          >
            <Swords size={18} />
            <span>Latihan Solo vs AI Bot</span>
          </button>
        </div>

        {/* Modal Gabung Room */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-cyan-500/50 rounded-lg p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-lg font-tech font-bold text-cyan-400 mb-2">GABUNG ROOM TEMAN</h3>
              <p className="text-xs text-slate-300 mb-4">
                Masukkan kode room yang diberikan temanmu (contoh: MABAR-7X atau ARENA-1)
              </p>
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="KODE ROOM..."
                className="w-full px-4 py-2.5 bg-black border border-cyan-500/50 rounded text-center font-mono font-bold text-lg text-cyan-300 uppercase tracking-widest focus:outline-none focus:border-cyan-400 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded font-tech text-sm hover:bg-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleJoinWithCode}
                  disabled={!roomCodeInput.trim()}
                  className="flex-1 py-2 bg-cyan-600 disabled:opacity-50 text-slate-950 font-tech font-bold rounded text-sm hover:bg-cyan-500 cursor-pointer"
                >
                  Masuk Match
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Flat Control Hint Line (Mandated by Game Craft Guidelines) */}
      <div className="w-full max-w-4xl flex flex-col items-center gap-2 pt-2 border-t border-slate-800/80 text-center">
        <p className="text-xs sm:text-sm font-mono text-cyan-400/90 tracking-widest uppercase">
          WASD Bergerak · Klik Kiri Tembak · Klik Kanan Keker (ADS) · Spasi Lompat · R Reload · V Ganti Kamera · Tab Skor
        </p>
        <span className="text-[11px] text-slate-400">
          Tip: Tekan Jump Pad di lantai untuk meluncur tinggi ke lantai atas menara!
        </span>
      </div>
    </div>
  );
};
