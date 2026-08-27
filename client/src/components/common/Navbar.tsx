import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useCosmosStore } from '../../store/useCosmosStore';
import { useMatchmakerStore } from '../../store/useMatchmakerStore';
import { AuthModal } from '../auth/AuthModal';

export const Navbar: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { users, isConnected, proximityConnections } = useCosmosStore();
  const { openMatchmaker } = useMatchmakerStore();

  const totalUsers = Object.keys(users).length + 1; // peers + self

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between shadow-lg">
        {/* Logo & Space Meta */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-lg shadow-md shadow-blue-500/20">
            🌌
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-white tracking-tight">Virtual Cosmos</h1>
              <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-950 text-blue-400 border border-blue-800/80 rounded-full">
                Alpha Hub
              </span>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              {isConnected ? 'FastAPI Async Engine Active' : 'Connecting to Gateway...'}
            </p>
          </div>
        </div>

        {/* Center Proximity & Population stats */}
        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="px-3 py-1 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center gap-2 text-slate-300">
            <span className="text-blue-400 font-bold font-mono">{totalUsers}</span>
            <span className="text-slate-400 text-[11px]">Explorers Online</span>
          </div>

          <div className="px-3 py-1 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400 font-bold font-mono">{proximityConnections.length}</span>
            <span className="text-slate-400 text-[11px]">In Proximity</span>
          </div>
        </div>

        {/* Right Actions: AI Matchmaker + Auth */}
        <div className="flex items-center gap-3">
          {/* AI Matchmaker Trigger */}
          <button
            onClick={openMatchmaker}
            className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 transform hover:scale-105 active:scale-95"
          >
            <span>🤖</span>
            <span>AI Matchmaker</span>
            <span className="px-1.5 py-0.2 text-[9px] bg-white/20 rounded-md font-mono">pgvector</span>
          </button>

          {/* Auth Button */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5">
              <span className="text-lg">{user.profile?.avatar_emoji || '👨‍🚀'}</span>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-white leading-tight">
                  {user.profile?.display_name || user.username}
                </div>
                <div className="text-[10px] text-slate-400">@{user.username}</div>
              </div>
              <button
                onClick={logout}
                title="Sign Out"
                className="ml-2 text-xs text-slate-400 hover:text-rose-400 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition"
            >
              Sign In / Join
            </button>
          )}
        </div>
      </header>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};
