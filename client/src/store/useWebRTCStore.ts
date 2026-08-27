import { create } from 'zustand';
import { CallState, CallType } from '../types/webrtc';

interface WebRTCState {
  callState: CallState;
  callType: CallType;
  peerUserId: string | null;
  peerName: string;
  peerAvatar: string;
  isMicMuted: boolean;
  isCamOff: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;

  startCall: (targetUserId: string, targetName: string, targetAvatar: string, type?: CallType) => void;
  incomingCall: (callerUserId: string, callerName: string, callerAvatar: string, type?: CallType) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
  toggleScreenShare: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setScreenSharing: (isSharing: boolean) => void;
}

export const useWebRTCStore = create<WebRTCState>((set, get) => ({
  callState: 'idle',
  callType: 'video',
  peerUserId: null,
  peerName: '',
  peerAvatar: '👤',
  isMicMuted: false,
  isCamOff: false,
  isScreenSharing: false,
  localStream: null,
  remoteStream: null,

  startCall: (targetUserId, targetName, targetAvatar, type = 'video') => set({
    callState: 'calling',
    peerUserId: targetUserId,
    peerName: targetName,
    peerAvatar: targetAvatar,
    callType: type,
  }),

  incomingCall: (callerUserId, callerName, callerAvatar, type = 'video') => set({
    callState: 'incoming',
    peerUserId: callerUserId,
    peerName: callerName,
    peerAvatar: callerAvatar,
    callType: type,
  }),

  acceptCall: () => set({ callState: 'connected' }),

  rejectCall: () => {
    const { localStream } = get();
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    set({
      callState: 'idle',
      peerUserId: null,
      localStream: null,
      remoteStream: null,
    });
  },

  endCall: () => {
    const { localStream } = get();
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    set({
      callState: 'idle',
      peerUserId: null,
      localStream: null,
      remoteStream: null,
      isScreenSharing: false,
    });
  },

  toggleMic: () => {
    const { localStream, isMicMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicMuted; // Invert
      });
    }
    set({ isMicMuted: !isMicMuted });
  },

  toggleCam: () => {
    const { localStream, isCamOff } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isCamOff; // Invert
      });
    }
    set({ isCamOff: !isCamOff });
  },

  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),

  setLocalStream: (stream) => set({ localStream: stream }),

  setRemoteStream: (stream) => set({ remoteStream: stream }),

  setScreenSharing: (isSharing) => set({ isScreenSharing: isSharing })
}));
