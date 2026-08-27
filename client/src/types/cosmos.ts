export interface Space {
  id: string;
  name: string;
  slug: string;
  description?: string;
  max_capacity: number;
  proximity_radius: number;
  boundary_width: number;
  boundary_height: number;
  is_private: boolean;
  active_users_count: number;
  created_at: string;
}

export interface CosmosUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  x: number;
  y: number;
  interests?: string[];
  skills?: string[];
}

export interface ProximityConnection {
  user_id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  x: number;
  y: number;
  room_key: string;
  distance?: number;
}

export interface UserPresence {
  socketId: string;
  userId: string;
  name: string;
  avatarEmoji: string;
  x: number;
  y: number;
  roomId?: string;
  roomName?: string;
}

export interface RoomZone {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ActiveConnection {
  roomId: string;
  roomName: string;
  peerUserId: string;
  peerName: string;
  peerAvatarEmoji: string;
  roomMemberCount: number;
  linkType: 'room' | 'radius';
}

export interface ChatMessageItem {
  roomId: string;
  channel: string;
  type: 'text' | 'sticker';
  text: string;
  senderUserId: string;
  senderName: string;
  senderAvatarEmoji: string;
  timestamp: string;
}
