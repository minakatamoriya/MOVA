import { create } from 'zustand';

export const useUiStore = create((set) => ({
  // current scene / context (driven by Phaser)
  sceneKey: null,
  inGame: false,
  setSceneKey: (key) => set({ sceneKey: key || null }),
  setInGame: (v) => set({ inGame: !!v }),

  // settings (driven by Phaser registry)
  showDamage: true,
  setShowDamage: (v) => set({ showDamage: !!v }),

  viewOpen: false,
  activeTab: 'classes',
  setViewOpen: (open) => set({ viewOpen: !!open }),
  setActiveTab: (tab) => set({ activeTab: tab || 'classes' }),

  // Phaser -> React snapshot (read-only UI state)
  viewData: {
    selectedTrees: [],
    skillTreeLevels: {},
    mainCore: null,
    offFaction: null,
    naturePetType: null,
    inventoryEquipped: [],
    inventoryAcquired: [],
    sessionCoins: 0,
    globalCoins: 0,
    ownedItems: [],
    equippedItems: [],
    levelUp: null,
    shop: null,
    gameOver: null,
    player: null
  },
  setViewData: (data) =>
    set((state) => ({
      viewData: {
        ...state.viewData,
        ...(data || {})
      }
    })),

  selectedTalent: null,
  setSelectedTalent: (talent) => set({ selectedTalent: talent || null }),

  selectedItem: null,
  setSelectedItem: (item) => set({ selectedItem: item || null })
}));
