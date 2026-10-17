import React from 'react';
import { Trophy, Skull, Crosshair, Users, X } from 'lucide-react';
import { NetworkPlayer } from '../types/game';

interface ScoreboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: NetworkPlayer[];
  localPlayerId: string;
  roomId: string;
  matchKills: number;
  matchDeaths: number;
}

export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({
  isOpen,
  onClose,
  players,
  localPlayerId,
  roomId,
  matchKills,
  matchDeaths,
}) => {
  if (!isOpen) return null;

  // Sort players by kills descending
  const sorted = [...players].sort((a, b) => b.kills - a.kills);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none pointer-events-auto font-tech">
      <div className="bg-slate-950 border border-cyan-500/50 rounded-lg max-w-2xl w-full p-6 shadow-[0_0_50px_rgba(0,240,255,0.25)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-400" size={24} />
            <div>
              <h2 className="text-xl font-black text-white tracking-wider">PAPAN SKOR MABAR</h2>
              <span className="text-xs font-mono text-cyan-400">ROOM: {roomId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Player Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-mono text-slate-400 uppercase tracking-wider">
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Prajurit</th>
                <th className="py-2 px-3 text-center">Kills</th>
                <th className="py-2 px-3 text-center">Deaths</th>
                <th className="py-2 px-3 text-center">K/D</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 font-mono">
              {sorted.map((p, idx) => {
                const isLocal = p.id === localPlayerId;
                const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills.toString();

                return (
                  <tr
                    key={p.id}
                    className={`${
                      isLocal ? 'bg-cyan-950/40 text-cyan-200 font-bold' : 'text-slate-300 hover:bg-slate-900/50'
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      {idx === 0 ? '👑 1' : idx + 1}
                    </td>
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span>{p.name}</span>
                      {isLocal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500 text-black font-black uppercase">
                          ANDA
                        </span>
                      )}
                      {p.isBot && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          BOT
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-400 tabular-nums">
                      {p.kills}
                    </td>
                    <td className="py-2.5 px-3 text-center text-red-400 tabular-nums">
                      {p.deaths}
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums text-slate-300">
                      {kd}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs">
                      {p.health > 0 ? (
                        <span className="text-emerald-400">Aktif</span>
                      ) : (
                        <span className="text-red-500">Respawning...</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800">
          <span>Tekan [Tab] atau tombol [X] untuk kembali bermain</span>
          <span className="text-cyan-400">Total Kills Anda: {matchKills}</span>
        </div>
      </div>
    </div>
  );
};
