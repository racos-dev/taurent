import { create } from 'zustand';

export interface SidebarState {
  isOpen: boolean;
  activeSection: string | null;
}

export interface ModalState {
  addTorrent: boolean;
  settings: boolean;
  filters: boolean;
  serverManager: boolean;
  keyboardShortcuts: boolean;
  about: boolean;
}

export interface UIState {
  sidebar: SidebarState;
  modals: ModalState;
  searchQuery: string;
  isSearchFocused: boolean;
  statusMessage: string;
}

export interface UIStore extends UIState {
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  setSidebarSection: (section: string | null) => void;

  openModal: (modal: keyof ModalState) => void;
  closeModal: (modal: keyof ModalState) => void;
  toggleModal: (modal: keyof ModalState) => void;
  closeAllModals: () => void;

  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  setSearchFocused: (focused: boolean) => void;
  setStatusMessage: (message: string) => void;
  clearStatusMessage: () => void;

  isAnyModalOpen: () => boolean;
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebar: {
    isOpen: true,
    activeSection: null,
  },
  modals: {
    addTorrent: false,
    settings: false,
    filters: false,
    serverManager: false,
    keyboardShortcuts: false,
    about: false,
  },
  searchQuery: '',
  isSearchFocused: false,
  statusMessage: '',

  setSidebarOpen: (isOpen) =>
    set((state) => ({
      sidebar: { ...state.sidebar, isOpen },
    })),
  toggleSidebar: () =>
    set((state) => ({
      sidebar: { ...state.sidebar, isOpen: !state.sidebar.isOpen },
    })),
  setSidebarSection: (activeSection) =>
    set((state) => ({
      sidebar: { ...state.sidebar, activeSection },
    })),

  openModal: (modal) =>
    set((state) => ({
      modals: { ...state.modals, [modal]: true },
    })),
  closeModal: (modal) =>
    set((state) => ({
      modals: { ...state.modals, [modal]: false },
    })),
  toggleModal: (modal) =>
    set((state) => ({
      modals: { ...state.modals, [modal]: !state.modals[modal] },
    })),
  closeAllModals: () =>
    set({
      modals: {
        addTorrent: false,
        settings: false,
        filters: false,
        serverManager: false,
        keyboardShortcuts: false,
        about: false,
      },
    }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearSearch: () => set({ searchQuery: '' }),
  setSearchFocused: (isSearchFocused) => set({ isSearchFocused }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  clearStatusMessage: () => set({ statusMessage: '' }),

  isAnyModalOpen: () => {
    const { modals } = get();
    return Object.values(modals).some((isOpen) => isOpen);
  },
}));
