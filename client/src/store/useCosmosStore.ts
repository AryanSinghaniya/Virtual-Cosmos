import { create } from 'zustand';
import { CosmosUser, ProximityConnection, Space } from '../types/cosmos';

interface CosmosState {
  activeSpace: Space | null;
  users: Record<string, CosmosUser>;
  myPosition: { x: number; y: number };
  proximityRadius: number;
  proximityConnections: ProximityConnection[];
  isConnected: boolean;
  isMoving: boolean;

  setActiveSpace: (space: Space) => void;
  initWorld: (spaceId: string, radius: number, users: Record<string, CosmosUser>, myPos?: { x: number; y: number }) => void;
  upsertUser: (user: CosmosUser) => void;
  updateUserCoords: (userId: string, x: number, y: number) => void;
  removeUser: (userId: string) => void;
  setMyPosition: (x: number, y: number) => void;
  setProximityConnections: (connections: ProximityConnection[]) => void;
  setIsConnected: (connected: boolean) => void;
  setIsMoving: (moving: boolean) => void;
}

export const useCosmosStore = create<CosmosState>((set) => ({
  activeSpace: null,
  users: {},
  myPosition: { x: 400, y: 300 },
  proximityRadius: 160,
  proximityConnections: [],
  isConnected: false,
  isMoving: false,

  setActiveSpace: (space) => set({ activeSpace: space, proximityRadius: space.proximity_radius }),

  initWorld: (spaceId, radius, users, myPos) => set((state) => ({
    proximityRadius: radius,
    users,
    myPosition: myPos || state.myPosition,
    isConnected: true
  })),

  upsertUser: (user) => set((state) => ({
    users: { ...state.users, [user.user_id]: user }
  })),

  updateUserCoords: (userId, x, y) => set((state) => {
    const existing = state.users[userId];
    if (!existing) return state;
    return {
      users: {
        ...state.users,
        [userId]: { ...existing, x, y }
      }
    };
  }),

  removeUser: (userId) => set((state) => {
    const nextUsers = { ...state.users };
    delete nextUsers[userId];
    const nextProximity = state.proximityConnections.filter((c) => c.user_id !== userId);
    return { users: nextUsers, proximityConnections: nextProximity };
  }),

  setMyPosition: (x, y) => set({ myPosition: { x, y } }),

  setProximityConnections: (connections) => set({ proximityConnections: connections }),

  setIsConnected: (connected) => set({ isConnected: connected }),

  setIsMoving: (moving) => set({ isMoving: moving })
}));
