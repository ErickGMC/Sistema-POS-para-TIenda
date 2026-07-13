import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DialogConfig {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  resolve?: (value: boolean) => void;
}

interface UIState {
  isLoading: boolean;
  loadingMessage: string;
  setLoading: (isLoading: boolean, message?: string) => void;
  dialog: DialogConfig;
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  closeDialog: (result: boolean) => void;
  // WhatsApp States
  isWhatsAppOpen: boolean;
  whatsAppUrl: string;
  isWhatsAppLinked: boolean;
  whatsappBusinessPhone: string;
  openWhatsApp: (phone: string, text: string) => void;
  closeWhatsApp: () => void;
  setWhatsAppLinked: (linked: boolean) => void;
  setWhatsappBusinessPhone: (phone: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isLoading: false,
      loadingMessage: '',
      setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),
      
      dialog: {
        isOpen: false,
        type: 'alert',
        title: '',
        message: '',
        resolve: undefined,
      },

      showAlert: (message: string, title = 'Advertencia') => {
        return new Promise<void>((resolve) => {
          set({
            dialog: {
              isOpen: true,
              type: 'alert',
              title,
              message,
              resolve: () => resolve(),
            },
          });
        });
      },

      showConfirm: (message: string, title = 'Confirmar Acción') => {
        return new Promise<boolean>((resolve) => {
          set({
            dialog: {
              isOpen: true,
              type: 'confirm',
              title,
              message,
              resolve,
            },
          });
        });
      },

      closeDialog: (result: boolean) => {
        set((state) => {
          if (state.dialog.resolve) {
            state.dialog.resolve(result);
          }
          return {
            dialog: {
              isOpen: false,
              type: 'alert',
              title: '',
              message: '',
              resolve: undefined,
            },
          };
        });
      },

      // WhatsApp Implementation
      isWhatsAppOpen: false,
      whatsAppUrl: 'https://web.whatsapp.com/',
      isWhatsAppLinked: false,
      whatsappBusinessPhone: '',
      openWhatsApp: (phone, text) => {
        set((state) => {
          let url = state.whatsAppUrl || 'https://web.whatsapp.com/';
          if (phone || text) {
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
              cleanPhone = '51' + cleanPhone;
            }
            const encodedText = encodeURIComponent(text);
            url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
          }
          return { isWhatsAppOpen: true, whatsAppUrl: url };
        });
      },
      closeWhatsApp: () => set({ isWhatsAppOpen: false }),
      setWhatsAppLinked: (linked) => set({ isWhatsAppLinked: linked }),
      setWhatsappBusinessPhone: (phone) => set({ whatsappBusinessPhone: phone }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        isWhatsAppLinked: state.isWhatsAppLinked,
        whatsappBusinessPhone: state.whatsappBusinessPhone,
      }),
    }
  )
);
