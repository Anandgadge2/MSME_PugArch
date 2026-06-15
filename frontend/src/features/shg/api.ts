import { api, readJsonResponse, unwrapApiData } from '../../lib/api';

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const json = async <T>(response: Response): Promise<T> => {
  const body = await readJsonResponse(response);
  if (!response.ok) throw new Error(body?.message || 'SHG request failed');
  return unwrapApiData<T>(body);
};

export const shgApi = {
  publicPost: <T>(endpoint: string, body: any) =>
    api.post(endpoint, body).then(response => json<T>(response)),
  get: <T>(endpoint: string) =>
    api.get(endpoint, { headers: authHeaders() }).then(response => json<T>(response)),
  post: <T>(endpoint: string, body: any) =>
    api.post(endpoint, body, { headers: authHeaders() }).then(response => json<T>(response)),
  patch: <T>(endpoint: string, body: any) =>
    api.patch(endpoint, body, { headers: authHeaders() }).then(response => json<T>(response)),
  delete: <T>(endpoint: string) =>
    api.delete(endpoint, { headers: authHeaders() }).then(response => json<T>(response)),
};

export type ShgProfile = {
  id: number;
  applicationNumber?: string | null;
  shgName: string;
  shgType: string;
  state: string;
  district: string;
  village: string;
  memberCount: number;
  registrationStatus: string;
  applicationStatus: string;
  progress?: number;
  representativeFirstName?: string | null;
  representativeLastName?: string | null;
  representativeMobile?: string | null;
  representativeEmail?: string | null;
  representativeRole?: string | null;
  organization?: any;
  members?: any[];
  bankAccounts?: any[];
  documents?: any[];
  onboardingProgress?: any[];
  auditLogs?: any[];
};
