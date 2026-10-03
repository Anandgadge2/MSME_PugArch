import { postApi } from './apiClient';

export type ProcurementSubmitPayload = {
  procurementType: 'RFQ' | 'RFP' | 'OPEN_TENDER' | 'LIMITED_TENDER' | 'RATE_CONTRACT';
  procurementId: number;
  items: Array<{
    itemId: number;
    basePrice: number;
    gstRate?: number;
    freightCharges?: number;
    quantity?: number;
    uom?: string;
    remarks?: string;
  }>;
  documents?: Array<{ documentType: string; fileAssetId: number }>;
  technicalPacket?: Record<string, unknown>;
  financialPacket?: Record<string, unknown>;
  remarks?: string;
};

/**
 * Unified procurement submission client.
 * Calls backend POST /api/procurement/submit.
 */
export async function submitProcurementQuotation(payload: ProcurementSubmitPayload) {
  return postApi<any>('/api/procurement/submit', payload);
}
