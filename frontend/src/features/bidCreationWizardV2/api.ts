import { api, readJsonResponse, unwrapApiData } from '../../lib/api';
import type { BidWizardDraft, PreviewResponse, StepValidationResponse } from './types/api';
import type { BidType, PacketType, WizardFormData } from './types/steps';

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parse = async <T>(response: Response): Promise<T> => {
  const body = await readJsonResponse(response);
  if (!response.ok) {
    const message = body?.message || body?.error || 'Bid wizard request failed';
    const err = new Error(message);
    (err as any).details = body?.details || body?.data;
    throw err;
  }
  return unwrapApiData<T>(body);
};

export const bidWizardApi = {
  createDraft: async (bidType: BidType, initialData: Record<string, any>) =>
    parse<BidWizardDraft>(await api.post('/api/buyer/bid-wizard/draft', { bidType, initialData }, { headers: authHeaders() })),

  getDraft: async (draftId: number) =>
    parse<BidWizardDraft>(await api.get(`/api/buyer/bid-wizard/draft/${draftId}`, { headers: authHeaders(), skipCache: true })),

  updateDraft: async (draftId: number, payload: { currentStep: number; formData: WizardFormData; validationState: Record<string, any>; completedSteps: number[] }) =>
    parse<BidWizardDraft>(await api.put(`/api/buyer/bid-wizard/draft/${draftId}`, payload, { headers: authHeaders() })),

  validateStep: async (step: number, formData: WizardFormData, bidType: BidType | null, packetType: PacketType) =>
    parse<StepValidationResponse>(await api.post('/api/buyer/bid-wizard/validate-step', { step, formData, bidType: bidType || undefined, packetType }, { headers: authHeaders() })),

  preview: async (draftId: number) =>
    parse<PreviewResponse>(await api.get(`/api/buyer/bid-wizard/preview/${draftId}`, { headers: authHeaders(), skipCache: true })),

  submit: async (draftId: number, submitForApproval = true) =>
    parse<any>(await api.post('/api/buyer/bid-wizard/submit', { draftId, submitForApproval }, { headers: authHeaders() })),

  deleteDraft: async (draftId: number) =>
    parse<BidWizardDraft>(await api.delete(`/api/buyer/bid-wizard/draft/${draftId}`, { headers: authHeaders() })),

  searchMasterData: async (kind: 'districts' | 'talukas' | 'villages', q = '', parent?: string) =>
    parse<Array<{ label: string; value: string }>>(await api.get(`/api/buyer/bid-wizard/master-data/${kind}?q=${encodeURIComponent(q)}${parent ? `&parent=${encodeURIComponent(parent)}` : ''}`, { headers: authHeaders(), skipCache: true })),

  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return parse<any>(await api.fetch('/api/upload', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    }));
  },
};
