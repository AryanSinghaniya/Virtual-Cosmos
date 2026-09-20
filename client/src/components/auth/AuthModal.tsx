import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

const DEMO_ACCOUNTS = [
  {
    name: 'Aryan (Full-Stack)',
    email: 'aryan@cosmos.io',
    password: 'Password123!',
    avatar: '👨‍🚀',
    skills: 'FastAPI, React, TypeScript, Docker',
  },
  {
    name: 'Elena (AI / pgvector)',
    email: 'elena@cosmos.io',
    password: 'Password123!',
    avatar: '🤖',
    skills: 'Python, pgvector, PyTorch, Embeddings',
  },
  {
    name: 'Marcus (Spatial WebRTC)',
    email: 'marcus@cosmos.io',
    password: 'Password123!',
    avatar: '🛰️',
    skills: 'React, WebRTC, PostGIS, TypeScript',
  },
];

const AVATARS = ['👨‍🚀', '👩‍🚀', '🚀', '🤖', '🛰️', '🪐', '👾', '⚡', '💻', '🐱', '🦊', '🐼', '🛸'];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('👨‍🚀');
  const [interestsText, setInterestsText] = useState('FastAPI, React, PostgreSQL, AI, WebSockets');
  const [skillsText, setSkillsText] = useState('Python, TypeScript, PostGIS, pgvector');

  const { login, register, isLoading, error, clearError } = useAuthStore();

  if (!isOpen) return null;

  const handleDemoFill = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setMode('login');
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (mode === 'register') {
        const interests = interestsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const skills = skillsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        await register({
          email: email.trim(),
          username: username.trim(),
          password,
          display_name: displayName.trim() || username.trim(),
          avatar_emoji: avatar,
          bio: bio.trim(),
          interests,
          skills,
        });
      } else {
        await login({ email: email.trim(), password });
      }
      onClose();
    } catch {
      // Error state captured in store
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-lg shadow-lg shadow-blue-500/20">
              🌌
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">
                {mode === 'login' ? 'Cosmos Authentication' : 'Create Pilot Account'}
              </h3>
              <p className="text-[11px] text-slate-400">
                JWT Bearer Auth • pgvector Profile Sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/70 border-b border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              clearError();
            }}
            className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              mode === 'login'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>⚡</span> Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              clearError();
            }}
            className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              mode === 'register'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>✨</span> Create Account
          </button>
        </div>

        {/* Quick Demo Fill Bar for Sign In */}
        {mode === 'login' && (
          <div className="px-6 pt-4 pb-1">
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>🚀 1-Click Demo Accounts:</span>
              <span className="text-[10px] text-blue-400">Pre-seeded with vector profiles</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  type="button"
                  key={acc.email}
                  onClick={() => handleDemoFill(acc)}
                  className="px-2 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-blue-500 rounded-xl text-left transition group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 group-hover:text-blue-400 truncate">
                    <span>{acc.avatar}</span>
                    <span className="truncate">{acc.name.split(' ')[0]}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">{acc.skills.split(',')[0]}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3 bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs rounded-xl flex items-center gap-2">
              <span className="text-rose-400 text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <>
              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Choose Pilot Avatar
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                  {AVATARS.map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => setAvatar(a)}
                      className={`text-xl p-2 rounded-xl border transition shrink-0 cursor-pointer ${
                        avatar === a
                          ? 'bg-blue-600/30 border-blue-500 scale-110 shadow-lg shadow-blue-500/20'
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. aryan_dev"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Aryan Singhaniya"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pilot Bio & Headline
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Full-Stack Engineer working on FastAPI & React"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Address <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. pilot@cosmos.io"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Password <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Technical Skills <span className="text-[10px] text-blue-400">(for AI pgvector match)</span>
                </label>
                <input
                  type="text"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="Comma separated: React, FastAPI, Python, Docker"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Interests & Passions
                </label>
                <input
                  type="text"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="Comma separated: AI, WebSockets, PostGIS, WebRTC"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : mode === 'login' ? (
                '⚡ Sign In to Cosmos'
              ) : (
                '✨ Register & Create Account'
              )}
            </button>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                clearError();
              }}
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
            >
              {mode === 'login'
                ? "Don't have an account yet? Create one here"
                : 'Already have an account? Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
