export type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';
export type CallType = 'audio' | 'video';

export interface WebRTCSignal {
  type: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:candidate' | 'webrtc:call-user' | 'webrtc:hangup';
  target_user_id: string;
  sender_id?: string;
  sdp?: any;
  candidate?: any;
  call_type?: CallType;
  caller_name?: string;
  caller_avatar?: string;
}
