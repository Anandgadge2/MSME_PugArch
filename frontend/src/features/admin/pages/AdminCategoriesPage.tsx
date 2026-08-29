import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, RefreshCw, FolderPlus, CheckCircle2, AlertTriangle, Layers, Tag, ArrowUp, ArrowDown, ArrowUpDown, Upload, Image as ImageIcon, X, Package, Wrench, Boxes, RotateCcw, Clock, Calendar, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Pagination } from '../../shared/Pagination';
import { usePagination } from '../../shared/hooks';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { getCategoryImageUrl, buildCategoryFallbackSvg, BUNDLED_CATEGORY_PHOTO_VERSION } from '../../marketplace/utils/categoryImages';
import { KpiCard } from '../../shared/KpiCard';

export interface Category {
  id: number;
  name: string;
  slug: string;
  type: 'PRODUCT' | 'SERVICE' | 'BOTH';
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

type SortField = 'id' | 'name' | 'type' | 'slug' | 'isActive' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [imageFilter, setImageFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'PRODUCT' | 'SERVICE' | 'BOTH'>('BOTH');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      let res = await api.fetch('/api/admin/categories');
      if (!res.ok) {
        res = await api.fetch('/api/categories');
      }
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        setCategories(list);
      } else {
        toast.error('Failed to load categories');
      }
    } catch {
      toast.error('Error connecting to categories API');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'updatedAt' ? 'desc' : 'asc');
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormType('BOTH');
    setFormDescription('');
    setFormImageUrl('');
    setFormIsActive(true);
    setImagePreview('');
    setPendingImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsAddModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormType(cat.type || 'BOTH');
    setFormDescription(cat.description || '');
    setFormImageUrl(cat.imageUrl || '');
    setFormIsActive(cat.isActive !== false);
    setImagePreview(cat.imageUrl || '');
    setPendingImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsAddModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPG, or WebP photo');
      return;
    }

    setPendingImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadCategoryImage = async (categoryId: number, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await api.fetch(`/api/admin/categories/${categoryId}/image`, {
        method: 'POST',
        body: formData,
        headers: {} // let browser set content-type with boundary
      });
      if (res.ok) {
        const updated = await res.json();
        const newUrl = updated?.data?.imageUrl || updated?.imageUrl || '';
        if (!newUrl) throw new Error('Cloud upload completed without an image URL');
        return newUrl;
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to upload image');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Network error uploading image');
    }
  };

  const handleRemoveImage = () => {
    setImagePreview('');
    setFormImageUrl('');
    setPendingImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleStatus = async (cat: Category, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextStatus = !cat.isActive;
    setTogglingId(cat.id);

    // Optimistic UI update
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, isActive: nextStatus, updatedAt: new Date().toISOString() } : c));

    try {
      let res = await api.fetch(`/api/admin/categories/${cat.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus })
      });
      if (!res.ok) {
        res = await api.fetch(`/api/admin/categories/${cat.id}`, {
          method: 'PUT',
          body: JSON.stringify({ isActive: nextStatus })
        });
      }
      if (res.ok) {
        toast.success(`Category "${cat.name}" is now ${nextStatus ? 'ACTIVE' : 'INACTIVE'}`);
      } else {
        throw new Error('Failed to update status');
      }
    } catch {
      // Rollback on failure
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, isActive: !nextStatus } : c));
      toast.error(`Could not update status for "${cat.name}"`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = editingCategory
        ? await api.fetch(`/api/admin/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formName.trim(),
            type: formType,
            description: formDescription.trim() || undefined,
            imageUrl: formImageUrl || null,
            isActive: formIsActive
          })
        })
        : await api.fetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: formName.trim(),
            type: formType,
            description: formDescription.trim() || undefined,
            imageUrl: null,
            isActive: formIsActive
          })
        });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to ${editingCategory ? 'update' : 'create'} category`);
      }

      const savedResponse = await res.json();
      const savedCategory = savedResponse?.data || savedResponse;
      if (pendingImageFile) {
        try {
          await uploadCategoryImage(Number(savedCategory.id), pendingImageFile);
        } catch (imgErr) {
          toast.warning(`Category ${editingCategory ? 'updated' : 'created'}, but image upload had an issue: ${imgErr instanceof Error ? imgErr.message : 'Upload failed'}`);
          setIsAddModalOpen(false);
          await fetchCategories();
          return;
        }
      }

      toast.success(`Category ${editingCategory ? 'updated' : 'created'} successfully!`);
      setIsAddModalOpen(false);
      await fetchCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error while saving category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsSubmitting(true);
    try {
      const res = await api.fetch(`/api/admin/categories/${deletingCategory.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success(`Category "${deletingCategory.name}" permanently deleted successfully`);
        setCategories(prev => prev.filter(c => c.id !== deletingCategory.id));
        setDeletingCategory(null);
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to permanently delete category');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error deleting category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFiltered = Boolean(
    searchQuery.trim() ||
    typeFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    imageFilter !== 'ALL'
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (imageFilter !== 'ALL') count++;
    return count;
  }, [typeFilter, statusFilter, imageFilter]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setImageFilter('ALL');
    setSortField('name');
    setSortOrder('asc');
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return { date: '—', time: '' };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { date: '—', time: '' };
      const date = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const time = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return { date, time, iso: d.toISOString() };
    } catch {
      return { date: '—', time: '' };
    }
  };

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = categories.filter(cat => {
      const matchesSearch = !query || 
        cat.name.toLowerCase().includes(query) || 
        cat.slug.toLowerCase().includes(query) ||
        (cat.description && cat.description.toLowerCase().includes(query));

      const matchesType = typeFilter === 'ALL' || cat.type === typeFilter;

      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && cat.isActive !== false) ||
        (statusFilter === 'INACTIVE' && cat.isActive === false);

      const hasCustomImage = Boolean(cat.imageUrl && !cat.imageUrl.startsWith('data:image/svg+xml'));
      const matchesImage = imageFilter === 'ALL' ||
        (imageFilter === 'WITH_IMAGE' && hasCustomImage) ||
        (imageFilter === 'FALLBACK_ONLY' && !hasCustomImage);

      return matchesSearch && matchesType && matchesStatus && matchesImage;
    });

    return list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'updatedAt') {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (sortField === 'isActive') {
        valA = a.isActive !== false ? 1 : 0;
        valB = b.isActive !== false ? 1 : 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      } else if (valA == null) {
        valA = '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [categories, searchQuery, typeFilter, statusFilter, imageFilter, sortField, sortOrder]);

  const { page, pageSize, pageItems: pagedCategories, total, setPage, setPageSize } = usePagination(filteredCategories, 10);

  const stats = useMemo(() => {
    return {
      total: categories.length,
      product: categories.filter(c => c.type === 'PRODUCT').length,
      service: categories.filter(c => c.type === 'SERVICE').length,
      both: categories.filter(c => c.type === 'BOTH').length,
      active: categories.filter(c => c.isActive !== false).length,
    };
  }, [categories]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Categories Management
            </h1>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-100">
              Admin Control
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Manage product and service classification taxonomy, icons, and marketplace visibility.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCategories}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={openAddModal}
            className="h-9 gap-1.5 text-xs font-bold bg-[#12335f] hover:bg-[#0b2445] text-white shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total Categories"
          value={stats.total}
          subtext="Configured marketplace groups"
          icon={Layers}
          tone="blue"
        />
        <KpiCard
          label="Product Only"
          value={stats.product}
          subtext="Physical merchandise items"
          icon={Package}
          tone="green"
        />
        <KpiCard
          label="Service Only"
          value={stats.service}
          subtext="Professional services"
          icon={Wrench}
          tone="purple"
        />
        <KpiCard
          label="Both (Hybrid)"
          value={stats.both}
          subtext="Dual supply & services"
          icon={Boxes}
          tone="indigo"
        />
        <KpiCard
          label="Active Status"
          value={stats.active}
          subtext="Live on buyer portal"
          icon={CheckCircle2}
          tone="cyan"
        />
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs">
        <ResponsiveFilterBar
          activeFilterCount={activeFilterCount}
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                aria-label="Search categories by name, slug, or description"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories by name, slug, description..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-9 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search input"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          }
          filters={
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Type Filter */}
              <div className="w-full sm:w-auto sm:min-w-[140px]">
                <label htmlFor="category-type-filter" className="sr-only">Filter by Category Type</label>
                <select
                  id="category-type-filter"
                  aria-label="Filter by Category Type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  <option value="BOTH">Both (Product & Service)</option>
                  <option value="PRODUCT">Product Only</option>
                  <option value="SERVICE">Service Only</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-auto sm:min-w-[130px]">
                <label htmlFor="category-status-filter" className="sr-only">Filter by Status</label>
                <select
                  id="category-status-filter"
                  aria-label="Filter by Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>

              {/* Image Filter */}
              <div className="w-full sm:w-auto sm:min-w-[140px]">
                <label htmlFor="category-image-filter" className="sr-only">Filter by Photo Status</label>
                <select
                  id="category-image-filter"
                  aria-label="Filter by Photo Status"
                  value={imageFilter}
                  onChange={(e) => setImageFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="ALL">All Images</option>
                  <option value="WITH_IMAGE">Has Custom Photo</option>
                  <option value="FALLBACK_ONLY">Default Fallback</option>
                </select>
              </div>

              {/* Reset Filters Button */}
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="h-10 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-rose-300 bg-rose-50/70 text-rose-700 hover:bg-rose-100 hover:border-rose-400 text-xs font-bold transition-colors cursor-pointer"
                  title="Clear all active filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                <th className="py-3.5 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('id')}
                    className="inline-flex items-center justify-center gap-1.5 hover:text-indigo-600 transition-colors font-extrabold cursor-pointer"
                    title="Sort by SR. NO."
                  >
                    SR. NO.
                    {sortField === 'id' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-70" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-center">IMAGE</th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors font-extrabold cursor-pointer"
                    title="Sort by Category Name"
                  >
                    CATEGORY NAME
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-70" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('type')}
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors font-extrabold cursor-pointer"
                    title="Sort by Type"
                  >
                    TYPE
                    {sortField === 'type' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-70" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('slug')}
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors font-extrabold cursor-pointer"
                    title="Sort by Slug"
                  >
                    SLUG
                    {sortField === 'slug' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-70" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('isActive')}
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors font-extrabold cursor-pointer"
                    title="Sort by Status"
                  >
                    STATUS
                    {sortField === 'isActive' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-70" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('updatedAt')}
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors font-extrabold cursor-pointer"
                    title="Sort by Last Updated Date & Time"
                  >
                    UPDATED AT
                    {sortField === 'updatedAt' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-70" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    Loading categories...
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p>No categories found matching your criteria.</p>
                      {isFiltered && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="text-xs font-semibold mt-1"
                        >
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedCategories.map((cat, idx) => {
                  const displayImg = getCategoryImageUrl(cat as any);
                  const dateInfo = formatDateTime(cat.updatedAt || cat.createdAt);
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {String((page - 1) * pageSize + idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="h-10 w-10 mx-auto rounded-lg border border-slate-200/80 bg-white flex items-center justify-center shadow-2xs overflow-hidden">
                          <img
                            src={displayImg}
                            alt={cat.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = buildCategoryFallbackSvg(cat.name);
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{cat.name}</div>
                        {cat.description && (
                          <div className="text-[11px] text-slate-400 font-medium truncate max-w-xs">{cat.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          cat.type === 'PRODUCT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          cat.type === 'SERVICE' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {cat.type || 'BOTH'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {cat.slug}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={cat.isActive !== false}
                          aria-label={`Toggle status for ${cat.name}. Currently ${cat.isActive !== false ? 'Active' : 'Inactive'}`}
                          disabled={togglingId === cat.id}
                          onClick={(e) => handleToggleStatus(cat, e)}
                          title={`Click to ${cat.isActive !== false ? 'Deactivate' : 'Activate'} "${cat.name}"`}
                          className={`group inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border cursor-pointer ${
                            cat.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 shadow-2xs'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:border-slate-300'
                          } ${togglingId === cat.id ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          <span className={`h-2 w-2 rounded-full transition-colors ${
                            cat.isActive !== false ? 'bg-emerald-500 group-hover:bg-emerald-600' : 'bg-slate-400 group-hover:bg-slate-500'
                          }`} />
                          <span>{cat.isActive !== false ? 'ACTIVE' : 'INACTIVE'}</span>
                          <span className={`inline-flex items-center h-3.5 w-6 rounded-full p-0.5 transition-colors ${
                            cat.isActive !== false ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}>
                            <span className={`h-2.5 w-2.5 rounded-full bg-white shadow-xs transform transition-transform ${
                              cat.isActive !== false ? 'translate-x-2.5' : 'translate-x-0'
                            }`} />
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {dateInfo.date !== '—' ? (
                          <div className="flex flex-col" title={dateInfo.iso}>
                            <span className="font-semibold text-slate-800 text-[11px]">
                              {dateInfo.date}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {dateInfo.time}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(cat)}
                            title="Edit Category"
                            aria-label={`Edit ${cat.name}`}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingCategory(cat)}
                            title="Delete Category"
                            aria-label={`Delete ${cat.name}`}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200/80 bg-white">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="categories"
          />
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 tracking-wide mb-1.5">
                  Category Name *
                </label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Solar & Renewable Energy"
                  required
                  className="h-10 border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 tracking-wide mb-1.5">
                  Category Type *
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full h-10 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="BOTH">Both (Product & Service)</option>
                  <option value="PRODUCT">Product Only</option>
                  <option value="SERVICE">Service Only</option>
                </select>
              </div>

              {/* Category photo upload */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 tracking-wide mb-1.5">
                  Category Photo
                </label>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="flex items-center gap-3.5 p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                    <div className="h-14 w-14 rounded-lg border border-slate-200 bg-white flex items-center justify-center shadow-2xs shrink-0 overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Category Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800">Image Ready</div>
                      <div className="text-[11px] text-slate-500">Uploaded to GCP when the category is saved</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                        >
                          Change Image
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="text-[11px] font-bold text-red-600 hover:text-red-800 underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-lg p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-700">Click to upload a realistic category photo</div>
                    <div className="text-[10px] text-slate-400 font-medium">PNG, JPG, or WebP (max 5MB); portrait or square works best</div>
                  </div>
                )}
              </div>

              {/* Active Status in Edit/Add Modal */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <div>
                  <label htmlFor="form-is-active" className="text-xs font-bold uppercase text-slate-700 tracking-wide block">
                    Active Status
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {formIsActive ? 'Visible to buyers on marketplace and taxonomy' : 'Hidden from active marketplace selections'}
                  </p>
                </div>
                <button
                  type="button"
                  id="form-is-active"
                  role="switch"
                  aria-checked={formIsActive}
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                    formIsActive ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 tracking-wide mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief summary of items/services under this category..."
                  rows={3}
                  className="w-full rounded border border-slate-300 p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                  className="h-10 px-4 text-xs font-bold border-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-6 bg-[#12335f] hover:bg-[#0b2445] text-white text-xs font-bold tracking-wide"
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200">
              <Trash2 className="h-6 w-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Permanently Delete Category?</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                Are you sure you want to permanently delete <span className="font-bold text-slate-800">"{deletingCategory.name}"</span>?
              </p>
              <div className="mt-2.5 p-2.5 rounded-lg bg-red-50/80 border border-red-200/80 text-[11px] text-red-700 font-semibold text-left">
                ⚠️ This action cannot be undone. This category and its database record will be permanently deleted.
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingCategory(null)}
                disabled={isSubmitting}
                className="h-10 px-4 text-xs font-bold border-slate-300 w-full"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteCategory}
                disabled={isSubmitting}
                className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold tracking-wide w-full shadow-xs"
              >
                {isSubmitting ? 'Deleting...' : 'Permanently Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
