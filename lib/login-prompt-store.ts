'use client';

import { create } from 'zustand';

interface LoginPromptState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useLoginPrompt = create<LoginPromptState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
