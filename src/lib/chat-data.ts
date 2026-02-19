export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file' | 'system';
  reactions?: { emoji: string; userId: string }[];
  read?: boolean;
}

export interface Chat {
  id: string;
  participants: User[];
  messages: Message[];
  isGroup: boolean;
  name?: string;
  lastMessage?: Message;
  unreadCount: number;
  typing?: string[];
}

const avatarColors = ['175,80%,50%', '260,60%,55%', '320,70%,55%', '220,80%,55%', '150,70%,50%', '40,90%,55%'];

export function getAvatarGradient(index: number): string {
  const c1 = avatarColors[index % avatarColors.length];
  const c2 = avatarColors[(index + 2) % avatarColors.length];
  return `linear-gradient(135deg, hsl(${c1}), hsl(${c2}))`;
}

export const currentUser: User = {
  id: 'me',
  name: 'You',
  avatar: '',
  status: 'online',
};

export const mockUsers: User[] = [
  { id: '1', name: 'Aria Chen', avatar: '', status: 'online' },
  { id: '2', name: 'Marcus Webb', avatar: '', status: 'online' },
  { id: '3', name: 'Luna Petrov', avatar: '', status: 'away', lastSeen: '2 min ago' },
  { id: '4', name: 'Kai Nakamura', avatar: '', status: 'offline', lastSeen: '1h ago' },
  { id: '5', name: 'Zara Mitchell', avatar: '', status: 'online' },
  { id: '6', name: 'Devon Park', avatar: '', status: 'offline', lastSeen: '3h ago' },
];

function makeMsg(id: string, senderId: string, content: string, minsAgo: number): Message {
  return { id, senderId, content, timestamp: new Date(Date.now() - minsAgo * 60000), type: 'text', read: true };
}

export const mockChats: Chat[] = [
  {
    id: 'c1', participants: [mockUsers[0]], isGroup: false, unreadCount: 2,
    messages: [
      makeMsg('m1', '1', 'Hey! Have you seen the new WebGL shader demos?', 45),
      makeMsg('m2', 'me', 'Yes! The fluid simulation one is incredible', 42),
      makeMsg('m3', '1', 'Right?? I want to integrate something similar into our project', 38),
      makeMsg('m4', 'me', 'Let me send you the repo link, the performance is surprisingly good', 35),
      makeMsg('m5', '1', 'That would be amazing, thanks! Also, are you free for a call later?', 3),
      makeMsg('m6', '1', 'We should discuss the spatial audio implementation too 🎧', 1),
    ],
  },
  {
    id: 'c2', participants: [mockUsers[1]], isGroup: false, unreadCount: 0,
    messages: [
      makeMsg('m7', 'me', 'The E2EE implementation is passing all tests now', 120),
      makeMsg('m8', '2', 'Perfect! Did you use ECDH for the key exchange?', 115),
      makeMsg('m9', 'me', 'Yes, with HKDF for key derivation and AES-GCM for encryption', 110),
      makeMsg('m10', '2', 'Solid choices. Let\'s review the forward secrecy mechanism tomorrow', 100),
    ],
  },
  {
    id: 'c3', participants: [mockUsers[0], mockUsers[1], mockUsers[2]], isGroup: true, name: 'Project HyperChat', unreadCount: 5,
    messages: [
      makeMsg('m11', '1', 'Team standup in 10 minutes! 🚀', 30),
      makeMsg('m12', '2', 'On my way, just finishing the WebRTC stats dashboard', 28),
      makeMsg('m13', '3', 'I\'ll share the new UI mockups during the call', 25),
      makeMsg('m14', 'me', 'Sounds good, I\'ll demo the spatial audio feature', 20),
      makeMsg('m15', '1', 'This is going to be the best release yet!', 15),
    ],
  },
  {
    id: 'c4', participants: [mockUsers[3]], isGroup: false, unreadCount: 0,
    messages: [
      makeMsg('m16', '4', 'The IndexedDB migration is complete', 300),
      makeMsg('m17', 'me', 'Great work! How\'s the query performance?', 290),
      makeMsg('m18', '4', 'Sub-millisecond for most operations. Virtualized list handles 10k+ items smoothly', 280),
    ],
  },
  {
    id: 'c5', participants: [mockUsers[4]], isGroup: false, unreadCount: 1,
    messages: [
      makeMsg('m19', '5', 'Check out this particle system I built! ✨', 60),
      makeMsg('m20', 'me', 'Wow that\'s gorgeous! Are you using OffscreenCanvas?', 55),
      makeMsg('m21', '5', 'Yes, with Web Workers for the physics calculations', 50),
    ],
  },
];
