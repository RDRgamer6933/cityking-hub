export type GameMode = 'Survival' | 'PvP' | 'FFA' | 'Skyblock' | 'Creative' | 'Factions' | 'Prison' | 'Lifesteal' | 'Anarchy' | 'Minigames' | 'Hardcore' | 'SMP' | 'Parkour' | 'Bedwars' | 'Skywars' | 'OneBlock' | 'Earth' | 'Towny' | 'Roleplay' | 'KitPvP' | 'BoxPvP' | 'Vanilla' | 'Modded' | 'Pixelmon' | 'Cobblemon' | 'Gens' | 'Slimefun' | 'Build Battle' | 'Murder Mystery' | 'Hide and Seek' | 'TNT Run' | 'Eggwars' | 'Duels' | 'Practice' | 'UHC' | 'Speedrun' | 'Survival Games';

export interface Server {
  id: string;
  name: string;
  javaIp: string;
  bedrockIp?: string;
  bedrockPort?: number;
  motd?: string;
  motdColor?: string;
  discordUrl?: string;
  mode: GameMode[];
  version: string;
  description?: string;
  votes: number;
  isOfficial: boolean;
  createdBy: string;
  createdAt: any;
}

export interface Vote {
  id: string;
  userId: string;
  serverId: string;
  timestamp: any;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: any;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'user' | 'admin';
}

export interface Video {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  likes: number;
  createdBy: string;
  authorName: string;
  createdAt: any;
}

export type AppScreen = 'home' | 'leaderboard' | 'upload' | 'chat' | 'profile' | 'admin' | 'videos';
