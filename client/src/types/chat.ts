export type MessageType = 'text' | 'sticker' | 'system';

export interface ChatMessage {
  id: string;
  space_id: string;
  sender_id: string;
  sender_username: string;
  sender_display_name: string;
  sender_avatar: string;
  recipient_id?: string;
  room_key: string;
  content: string;
  message_type: MessageType;
  created_at: string;
}

export interface SendMessagePayload {
  space_id: string;
  recipient_id?: string;
  room_key: string;
  content: string;
  message_type?: MessageType;
}
