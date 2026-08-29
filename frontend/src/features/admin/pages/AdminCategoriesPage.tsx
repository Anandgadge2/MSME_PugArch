import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, RefreshCw, FolderPlus, CheckCircle2, AlertTriangle, Layers, Tag, ArrowUp, ArrowDown, ArrowUpDown, Upload, Image as ImageIcon, X, Package, Wrench, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Pagination } from '../../shared/Pagination';
import { usePagination } from '../../shared/hooks';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { getCategoryImageUrl } from '../../marketplace/utils/categoryImages';
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

type SortField = 'id' | 'name' | 'type' | 'slug' | 'isActive';
type SortOrder = 'asc' | 'desc';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
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
  const [imagePreview, setImagePreview] = useState<string>('');
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await api.fetch('/api/categories');
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
      setSortOrder('asc');
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormType('BOTH');
    setFormDescription('');
    setFormImageUrl('');
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
            imageUrl: formImageUrl || null
          })
        })
        : await api.fetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: formName.trim(),
            type: formType,
            description: formDescription.trim() || undefined,
            imageUrl: null
          })
        });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to ${editingCategory ? 'update' : 'create'} category`);
      }

      const savedResponse = await res.json();
      const savedCategory = savedResponse?.data || savedResponse;
      if (pendingImageFile) {
        await uploadCategoryImage(Number(savedCategory.id), pendingImageFile);
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
        toast.success('Category deleted / deactivated successfully');
        setDeletingCategory(null);
        fetchCategories();
      } else {
        toast.error('Failed to delete category');
      }
    } catch {
      toast.error('Error deleting category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = useMemo(() => {
    const list = categories.filter(cat => {
      const matchesSearch = !searchQuery || 
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        cat.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'ALL' || cat.type === typeFilter;
      return matchesSearch && matchesType;
    });

    return list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

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
  }, [categories, searchQuery, typeFilter, sortField, sortOrder]);

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
              Categories & Taxonomy Management
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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <ResponsiveFilterBar
          activeFilterCount={typeFilter !== 'ALL' ? 1 : 0}
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories by name or slug..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
            </div>
          }
          filters={
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <select
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
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      Loading categories taxonomy...
                    </td>
                  </tr>
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      No categories found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  pagedCategories.map((cat, idx) => {
                    const displayImg = getCategoryImageUrl(cat as any);
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
                                (e.target as HTMLElement).style.display = 'none';
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
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            cat.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cat.isActive !== false ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                            {cat.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(cat)}
                              title="Edit Category"
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingCategory(cat)}
                              title="Delete Category"
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
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Category?</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-800">"{deletingCategory.name}"</span>? It will be deactivated from active dropdown selections.
              </p>
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
                className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold tracking-wide w-full"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Category'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
