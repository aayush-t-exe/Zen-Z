import { create } from 'zustand';
import { fetchUnreadMessageCount } from '@/lib/groups';

// Shared across the (home) tab layout (renders the nav-bar badge) and the
// group chat screen (refreshes it the moment a group gets marked read),
// which are different mounted components — a plain useState in either
// one wouldn't be visible to the other, same reasoning as useAuthStore.
export interface ChatState {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  unreadCount: 0,
  refreshUnreadCount: async () => {
    const count = await fetchUnreadMessageCount();
    set({ unreadCount: count });
  },
}));
