import { useState, useCallback } from 'react';

export interface Trigger2FAOptions {
  actionType: string;
  actionTitle?: string;
  orderId?: number | string;
  amount?: number;
  onSuccess: () => void | Promise<void>;
}

export function useTransaction2FA() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    actionType: string;
    actionTitle?: string;
    orderId?: number | string;
    amount?: number;
    onSuccessCallback: () => void | Promise<void>;
  }>({
    isOpen: false,
    actionType: '',
    onSuccessCallback: () => {}
  });

  const require2FA = useCallback((options: Trigger2FAOptions) => {
    setModalState({
      isOpen: true,
      actionType: options.actionType,
      actionTitle: options.actionTitle,
      orderId: options.orderId,
      amount: options.amount,
      onSuccessCallback: options.onSuccess
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    is2FAModalOpen: modalState.isOpen,
    modalProps: {
      isOpen: modalState.isOpen,
      actionType: modalState.actionType,
      actionTitle: modalState.actionTitle,
      orderId: modalState.orderId,
      amount: modalState.amount,
      onClose: closeModal,
      onSuccess: modalState.onSuccessCallback
    },
    require2FA
  };
}
