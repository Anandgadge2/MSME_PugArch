import React, { ChangeEvent, FormEvent, InputHTMLAttributes, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Edit,
  Eye,
  EyeOff,
  ImagePlus,
  Images,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { EmptyState, LoadingState } from '../../shared/FeatureStates';
import { formatDate } from '../../shared/format';
import { Pagination } from '../../shared/Pagination';
import { usePagination } from '../../shared/hooks';
import { api, BASE_URL, readJsonResponse, unwrapApiData, resolveMediaUrl } from '../../../lib/api';
import { compressImage } from '../../../lib/compress';
import { cn } from '../../../lib/utils';
import { bannerApi } from '../api';

type BannerAction = 'approve' | 'reject' | 'show' | 'hide' | 'delete';

export type BannerRecord = {
  id: number;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  targetUrl?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  bannerType?: string;
  status?: string;
  isActive?: boolean;
  startAt?: string;
  endAt?: string;
  durationDays?: number;
  priority?: number;
  displayOrder?: number;
  displayLocation?: string;
  documentId?: number | null;
  uploadedByOrgId?: number | null;
  rejectionReason?: string | null;
};

type FormState = {
  id?: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaText: string;
  ctaLink: string;
  targetUrl: string;
  bannerType: string;
  displayLocation: string;
  priority: string;
  durationDays: string;
  status: string;
};

const initialForm: FormState = {
  title: '',
  subtitle: '',
  imageUrl: '',
  ctaText: '',
  ctaLink: '',
  targetUrl: '',
  bannerType: 'DEFAULT_ADMIN',
  displayLocation: 'HOME_HERO',
  priority: '50',
  durationDays: '30',
  status: 'ACTIVE'
};

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Hidden', value: 'HIDDEN' },
  { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' }
];

const imageSrc = (url?: string | null) => {
  if (!url || url.trim() === '') return '';
  const resolved = resolveMediaUrl(url);
  if (resolved) return resolved;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return url;
};

const statusTone = (status?: string) => {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'PENDING_APPROVAL') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'REJECTED') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'HIDDEN') return 'border-slate-200 bg-slate-100 text-slate-600';
  return 'border-blue-200 bg-blue-50 text-[#12335f]';
};

export default function AdminBannerManagementPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingBanner, setEditingBanner] = useState<BannerRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const query = useQuery({
    queryKey: ['admin-banners', statusFilter],
    queryFn: () => bannerApi.adminList(statusFilter),
    staleTime: 15_000
  });

  const banners: BannerRecord[] = query.data?.banners || [];
  const visibleBanners = useMemo(() => banners.filter(b => b.status !== 'DELETED'), [banners]);
  const { page, pageSize, pageItems: pagedBanners, total, setPage, setPageSize } = usePagination(visibleBanners, 12);
  const managedCount = visibleBanners.length;
  const activeCount = visibleBanners.filter(b => ['ACTIVE', 'APPROVED'].includes(String(b.status))).length;
  const hiddenCount = visibleBanners.filter(b => b.status === 'HIDDEN').length;

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-banners'] });

  const actionMutation = useMutation({
    mutationFn: ({ id, next }: { id: number; next: BannerAction }) =>
      bannerApi.updateStatus(id, next, next === 'reject' ? { reason: 'Rejected by admin review' } : {}),
    onSuccess: (_data, variables) => {
      setMessage(`Banner ${variables.next === 'delete' ? 'deleted' : variables.next === 'show' ? 'activated' : variables.next === 'hide' ? 'hidden' : 'updated'}.`);
      refresh();
    },
    onError: err => setMessage((err as Error).message)
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const payload: Record<string, unknown> = {
        title: data.title.trim(),
        subtitle: data.subtitle.trim() || undefined,
        imageUrl: data.imageUrl.trim() || undefined,
        ctaText: data.ctaText.trim() || undefined,
        ctaLink: (data.ctaLink.trim() || data.targetUrl.trim()) || undefined,
        targetUrl: (data.targetUrl.trim() || data.ctaLink.trim()) || undefined,
        bannerType: data.bannerType,
        displayLocation: data.displayLocation,
        priority: Number(data.priority || 50),
        durationDays: Number(data.durationDays || 30),
        status: data.status || 'ACTIVE'
      };

      if (data.id) {
        return bannerApi.update(data.id, payload);
      } else {
        return bannerApi.create(payload);
      }
    },
    onSuccess: () => {
      setMessage(editingBanner ? 'Banner updated successfully!' : 'New banner created successfully!');
      setIsModalOpen(false);
      setEditingBanner(null);
      setForm(initialForm);
      refresh();
    },
    onError: err => setMessage((err as Error).message)
  });

  const openCreateModal = () => {
    setEditingBanner(null);
    setForm(initialForm);
    setIsModalOpen(true);
    setMessage('');
  };

  const openEditModal = (banner: BannerRecord) => {
    setEditingBanner(banner);
    setForm({
      id: banner.id,
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      imageUrl: banner.imageUrl || '',
      ctaText: banner.ctaText || '',
      ctaLink: banner.ctaLink || banner.targetUrl || '',
      targetUrl: banner.targetUrl || banner.ctaLink || '',
      bannerType: banner.bannerType || 'DEFAULT_ADMIN',
      displayLocation: banner.displayLocation || 'HOME_HERO',
      priority: String(banner.priority ?? 50),
      durationDays: String(banner.durationDays ?? 30),
      status: banner.status || 'ACTIVE'
    });
    setIsModalOpen(true);
    setMessage('');
  };

  const uploadImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Please upload a valid JPG, PNG, WEBP, or SVG image.');
      return;
    }

    setUploading(true);
    setMessage('');
    try {
      const optimized = await compressImage(file, 1920, 1080, 0.85);
      const body = new FormData();
      body.append('file', optimized);
      const token = localStorage.getItem('token');
      const res = await api.fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body
      });
      const json = unwrapApiData<any>(await readJsonResponse(res));
      if (!res.ok) throw new Error(json?.message || 'Unable to upload banner image');

      const publicUrl = json?.url || json?.file?.url || json?.file?.documentUrl || '';
      if (!publicUrl) throw new Error('Upload completed but no image URL was returned.');

      setForm(prev => ({ ...prev, imageUrl: publicUrl }));
      setMessage('Image uploaded directly to GCP Storage!');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to upload banner image');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setMessage('Headline Title is required.');
      return;
    }
    if (!form.imageUrl.trim()) {
      setMessage('Please upload a banner image or provide an image URL.');
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-blue-50 px-2.5 text-[10px] font-black uppercase tracking-widest text-[#12335f] ring-1 ring-blue-700/10">
              Admin Portal
            </span>
            <span className="text-xs font-semibold text-slate-400">• Cloud Storage Live</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Banner Management</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Control, edit, and publish hero carousel banners hosted on Google Cloud Storage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={refresh} className="font-bold">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateModal} className="bg-[#12335f] font-bold text-white hover:bg-[#0b2447]">
            <Plus className="mr-1.5 h-4 w-4" />
            Add New Banner
          </Button>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-900 shadow-xs animate-in fade-in">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-blue-600 hover:text-blue-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total Banners" value={managedCount} icon={Images} />
        <MetricCard label="Active on Homepage" value={activeCount} tone="emerald" icon={Eye} />
        <MetricCard label="Hidden / Draft" value={hiddenCount} tone="slate" icon={EyeOff} />
        <MetricCard label="Storage Provider" value="GCP Bucket" subtitle="jsgsmile1" tone="blue" icon={UploadCloud} isText />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600">Filter by Status:</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-600/20"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          Showing <span className="font-bold text-slate-900">{visibleBanners.length}</span> database banners
        </p>
      </div>

      {/* Banners Grid */}
      {query.isLoading ? (
        <LoadingState label="Loading cloud banners..." />
      ) : visibleBanners.length === 0 ? (
        <EmptyState
          title="No banners found"
          description="There are no banners matching this filter. Click 'Add New Banner' to create one."
          icon={Images}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pagedBanners.map(banner => (
              <BannerAdminCard
                key={banner.id}
                banner={banner}
                busy={actionMutation.isPending || saveMutation.isPending}
                onEdit={() => openEditModal(banner)}
                onToggleVisibility={() =>
                  actionMutation.mutate({
                    id: banner.id,
                    next: banner.status === 'ACTIVE' ? 'hide' : 'show'
                  })
                }
                onDelete={() => {
                  if (confirm(`Are you sure you want to delete banner: "${banner.title}"?`)) {
                    actionMutation.mutate({ id: banner.id, next: 'delete' });
                  }
                }}
              />
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="banners"
            />
          </div>
        </div>
      )}

      {/* Modal for Create / Edit Banner */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  {editingBanner ? `Edit Banner [ID: ${editingBanner.id}]` : 'Create New Hero Banner'}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {editingBanner ? 'Update headline, links, priority, or replace the GCP image.' : 'Add a new high-impact banner to the homepage hero carousel.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4 p-6">
              {/* Image Preview & Upload Section */}
              <div>
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Banner Image (GCP Cloud Storage)
                </span>
                
                {/* Live Preview Box */}
                <div className="relative min-h-[160px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-inner">
                  {form.imageUrl ? (
                    <img
                      src={imageSrc(form.imageUrl)}
                      alt="Banner Preview"
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-44 w-full flex-col items-center justify-center gap-2 text-slate-400">
                      <ImagePlus className="h-10 w-10 text-slate-500" />
                      <span className="text-xs font-bold">No image selected</span>
                    </div>
                  )}
                  {form.imageUrl && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#07172e]/90 via-[#0b2447]/60 to-transparent p-4 flex flex-col justify-end">
                      <h4 className="max-w-md whitespace-pre-line text-sm font-black leading-tight text-white drop-shadow-sm">
                        {form.title || 'Headline Title Preview'}
                      </h4>
                      <p className="mt-1 line-clamp-1 max-w-md text-[11px] font-medium text-white/80">
                        {form.subtitle || 'Subtitle preview will appear here.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload Button Controls */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-[#12335f] ring-1 ring-blue-700/20 transition hover:bg-blue-100">
                    <UploadCloud className="h-4 w-4 text-blue-700" />
                    <span>{uploading ? 'Uploading to GCP...' : form.imageUrl ? 'Change Image' : 'Upload Image to GCP'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      onChange={uploadImageFile}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  {form.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                      className="rounded-lg px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Direct Image URL input (optional alternative) */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Or Image Public URL:
                </label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://storage.googleapis.com/jsgsmile1/banners/..."
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {/* Headline Title */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Headline Title * <span className="text-slate-400 font-normal">(use Enter for line break)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Steel & Metal Fabrication&#10;Powering Jharsuguda Industry"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-bold text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Subtitle Description
                </label>
                <textarea
                  rows={2}
                  value={form.subtitle}
                  onChange={e => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Source verified steel, TMT bars, industrial castings from local manufacturers."
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {/* CTA Row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={form.ctaText}
                    onChange={e => setForm(prev => ({ ...prev, ctaText: e.target.value }))}
                    placeholder="Browse Steel & Metal"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    CTA Button Link / URL
                  </label>
                  <input
                    type="text"
                    value={form.ctaLink}
                    onChange={e => setForm(prev => ({ ...prev, ctaLink: e.target.value, targetUrl: e.target.value }))}
                    placeholder="#products or /marketplace/products?categoryId=1"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              {/* Priority & Status Row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Priority Score (0-100)
                  </label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={e => setForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="ACTIVE">Active (Live)</option>
                    <option value="HIDDEN">Hidden (Paused)</option>
                    <option value="DRAFT">Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Display Location
                  </label>
                  <select
                    value={form.displayLocation}
                    onChange={e => setForm(prev => ({ ...prev, displayLocation: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="HOME_HERO">Homepage Hero</option>
                    <option value="MARKETPLACE_HOME">Marketplace Home</option>
                    <option value="DASHBOARD">Dashboard</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saveMutation.isPending || uploading}
                  className="bg-[#12335f] text-white hover:bg-[#0b2447]"
                >
                  {saveMutation.isPending ? 'Saving...' : editingBanner ? 'Save Changes' : 'Create Banner'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  tone = 'blue',
  icon: Icon,
  isText = false
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  tone?: 'blue' | 'emerald' | 'slate';
  icon: any;
  isText?: boolean;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className={cn("mt-1 font-black leading-none", isText ? "text-base text-blue-900" : "text-2xl text-slate-950")}>
            {value}
          </p>
          {subtitle && <p className="mt-1 text-[10px] font-semibold text-slate-400">{subtitle}</p>}
        </div>
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl ring-1",
          tone === 'emerald' ? "bg-emerald-50 text-emerald-600 ring-emerald-200" :
          tone === 'slate' ? "bg-slate-50 text-slate-600 ring-slate-200" :
          "bg-blue-50 text-blue-600 ring-blue-200"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function BannerAdminCard({
  banner,
  busy,
  onEdit,
  onToggleVisibility,
  onDelete
}: {
  banner: BannerRecord;
  busy: boolean;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const src = imageSrc(banner.imageUrl);
  const isActive = banner.status === 'ACTIVE' || banner.status === 'APPROVED';

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-xs transition hover:shadow-md">
      <CardContent className="flex h-full flex-col p-0">
        {/* Banner Visual Header */}
        <div className="relative min-h-[170px] overflow-hidden bg-slate-900">
          {src ? (
            <img
              src={src}
              alt={banner.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="flex h-full min-h-[170px] items-center justify-center bg-slate-100 text-slate-400">
              <ImagePlus className="h-8 w-8" />
            </div>
          )}

          {/* Dark scrim gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07172e]/90 via-[#07172e]/40 to-transparent" />

          {/* Top Badges */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            <span className={cn('rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider backdrop-blur-xs shadow-xs', statusTone(banner.status))}>
              {String(banner.status || 'ACTIVE')}
            </span>
            <span className="rounded-md bg-black/50 px-2 py-0.5 text-[9px] font-black text-white/90 backdrop-blur-xs">
              Priority: {banner.priority ?? 0}
            </span>
          </div>

          {/* Headline on Image */}
          <div className="relative flex min-h-[170px] flex-col justify-end p-4">
            <h3 className="whitespace-pre-line text-base font-black leading-tight text-white drop-shadow-sm line-clamp-2">
              {banner.title}
            </h3>
            {banner.subtitle && (
              <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-normal text-white/80">
                {banner.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Details & CTA Footer */}
        <div className="flex flex-1 flex-col justify-between p-4">
          <div className="space-y-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <LinkIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="truncate font-bold text-slate-800">
                {banner.ctaText || 'Button'}: <span className="text-slate-500 font-normal">{banner.ctaLink || banner.targetUrl || '#'}</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span>Location: {banner.displayLocation || 'HOME_HERO'}</span>
              <span>Updated: {formatDate(banner.startAt || new Date().toISOString())}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onEdit}
              className="flex-1 font-bold text-slate-800 hover:bg-slate-50 hover:text-blue-700"
            >
              <Edit className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onToggleVisibility}
              className={cn("flex-1 font-bold", isActive ? "text-amber-700 hover:bg-amber-50" : "text-emerald-700 hover:bg-emerald-50")}
            >
              {isActive ? (
                <>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Show
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={onDelete}
              className="px-2.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
