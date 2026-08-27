import React from 'react';
import { useWebRTCStore } from '../../store/useWebRTCStore';

export const VideoCallModal: React.FC = () => {
  const {
    callState,
    callType,
    peerName,
    peerAvatar,
    isMicMuted,
    isCamOff,
    isScreenSharing,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCam,
    toggleScreenShare
  } = useWebRTCStore();

  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Call Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{peerAvatar}</span>
            <div>
              <h3 className="font-bold text-white text-sm">{peerName}</h3>
              <p className="text-xs text-slate-400">
                {callState === 'calling' && 'Calling peer in Cosmos...'}
                {callState === 'incoming' && 'Incoming spatial AV call...'}
                {callState === 'connected' && 'WebRTC Peer-to-Peer Encrypted Call Connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              {callType.toUpperCase()} CALL
            </span>
          </div>
        </div>

        {/* Video Grid / Call Body */}
        <div className="p-6 bg-slate-950 flex-1 flex flex-col items-center justify-center min-h-[320px]">
          {callState === 'incoming' ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-emerald-900/40 border-2 border-emerald-500 flex items-center justify-center text-5xl animate-bounce">
                {peerAvatar}
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{peerName}</h4>
                <p className="text-xs text-slate-400">wants to start a spatial video session</p>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <button
                  onClick={acceptCall}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm shadow-lg transition flex items-center gap-2"
                >
                  <span>📞</span> Accept Call
                </button>
                <button
                  onClick={rejectCall}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm shadow-lg transition flex items-center gap-2"
                >
                  <span>✕</span> Decline
                </button>
              </div>
            </div>
          ) : callState === 'calling' ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-blue-900/40 border-2 border-blue-500 flex items-center justify-center text-5xl animate-pulse">
                {peerAvatar}
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{peerName}</h4>
                <p className="text-xs text-slate-400">Ringing peer...</p>
              </div>
              <button
                onClick={endCall}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm shadow-lg transition"
              >
                Cancel Call
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 w-full h-full">
              {/* Remote Video Placeholder / Stream */}
              <div className="relative bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center p-4 aspect-video overflow-hidden">
                <div className="text-4xl mb-2">{peerAvatar}</div>
                <p className="text-xs font-semibold text-slate-300">{peerName}</p>
                <span className="absolute bottom-2 left-2 text-[10px] bg-slate-950/80 px-2 py-0.5 rounded text-slate-400">
                  Remote Stream (WebRTC Active)
                </span>
              </div>

              {/* Local Video Placeholder / Stream */}
              <div className="relative bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center p-4 aspect-video overflow-hidden">
                <div className="text-4xl mb-2">🚀</div>
                <p className="text-xs font-semibold text-slate-300">You</p>
                <span className="absolute bottom-2 left-2 text-[10px] bg-slate-950/80 px-2 py-0.5 rounded text-slate-400">
                  {isCamOff ? 'Camera Disabled' : 'Camera Active'}
                </span>
                {isScreenSharing && (
                  <span className="absolute top-2 right-2 text-[10px] bg-indigo-900/90 text-indigo-200 px-2 py-0.5 rounded border border-indigo-700">
                    Screen Sharing
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Call Controls Bar */}
        {callState === 'connected' && (
          <div className="px-6 py-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-center gap-4">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-xl border transition ${
                isMicMuted
                  ? 'bg-rose-600/30 border-rose-500 text-rose-300'
                  : 'bg-slate-700 hover:bg-slate-650 border-slate-600 text-white'
              }`}
              title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMicMuted ? '🔇 Muted' : '🎤 Mic On'}
            </button>

            <button
              onClick={toggleCam}
              className={`p-3 rounded-xl border transition ${
                isCamOff
                  ? 'bg-rose-600/30 border-rose-500 text-rose-300'
                  : 'bg-slate-700 hover:bg-slate-650 border-slate-600 text-white'
              }`}
              title={isCamOff ? 'Turn Video On' : 'Turn Video Off'}
            >
              {isCamOff ? '🚫 Cam Off' : '📹 Cam On'}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-xl border transition ${
                isScreenSharing
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-650 border-slate-600 text-white'
              }`}
              title="Toggle Screen Share"
            >
              🖥️ {isScreenSharing ? 'Stop Share' : 'Share Screen'}
            </button>

            <button
              onClick={endCall}
              className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center gap-1.5"
            >
              <span>✕</span> End Call
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
