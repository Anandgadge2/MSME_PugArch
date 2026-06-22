import { getApi, postApi, putApi } from '../shared/apiClient';
import type { CartEvaluation, CheckoutFormData, ProcurementRequestDto } from './types';

export const evaluateCartProcurementMode = (payload: {
  cartId: number;
  selectedMethod?: string;
  proprietary?: boolean;
  buyerJustification?: string;
}) => postApi<CartEvaluation>('/api/procurement-mode/evaluate-cart', payload);

export const confirmProcurementMethod = (payload: {
  cartId: number;
  selectedMethod: string;
  justification?: string;
  l1ComparisonId?: number;
  pacJustification?: Record<string, unknown>;
  demandSplittingConfirmation?: boolean;
}) => postApi<{ procurementRequestId: number; checkoutDraftId: number; evaluation: CartEvaluation }>(
  '/api/procurement-mode/confirm',
  payload
);

export const initProcurementCheckout = (payload: CheckoutFormData & { cartId: number; justification?: string }) =>
  postApi<{ procurementRequestId: number; request: ProcurementRequestDto }>('/api/procurement-checkout/init', payload);

export const fetchProcurementRequest = (id: number) =>
  getApi<ProcurementRequestDto>(`/api/procurement-checkout/${id}`);

export const saveProcurementCheckout = (id: number, patch: Partial<CheckoutFormData>) =>
  putApi<ProcurementRequestDto>(`/api/procurement-checkout/${id}`, patch);

export const submitProcurementCheckout = (id: number) =>
  postApi<ProcurementRequestDto>(`/api/procurement-checkout/${id}/submit`, {});

export const finalizeDirectPurchase = (id: number) =>
  postApi<{ orders: { poId: number; poNumber: string; sellerId: number }[] }>(
    `/api/procurement-checkout/${id}/finalize-direct-purchase`,
    {}
  );

export const convertCheckoutToBid = (id: number) =>
  postApi<{ bidWizardDraftId: number; redirectPath: string }>(`/api/procurement-checkout/${id}/convert-to-bid`, {});

export const createL1ComparisonFromCart = (cartId: number) =>
  postApi<{ comparison: { id: number }; l1SellerId: number | null }>('/api/l1-comparisons/from-cart', { cartId });

export const fetchProcurementModeSettings = () =>
  getApi<Record<string, unknown>>('/api/procurement-mode/settings');
