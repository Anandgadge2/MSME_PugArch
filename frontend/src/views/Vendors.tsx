import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, MapPin, Star, Building2, ChevronDown, CheckCircle2, X, Phone, Mail, Globe, Briefcase, FileText, Send, Info, ShieldCheck, Clock, Upload, Paperclip, LayoutGrid, List, Filter, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare, MoreVertical } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { compressImage } from '../lib/compress';
import { indiaStatesDistricts } from '../data/indiaStatesDistricts';
import { KpiCard } from '../features/shared/KpiCard';
import { Pagination } from '../features/shared/Pagination';
import { EntityIdLink } from '../features/shared/EntityIdLink';
import { ViewModeToggle } from '../features/shared/ViewModeToggle';
import { GridCardSkeleton } from '../components/ui/skeleton';
import { ResponsiveFilterBar } from '../components/ui/ResponsiveFilterBar';
import { usePagination, useResponsiveViewMode } from '../features/shared/hooks';
import { useSupplierSummary } from '../features/ratings/hooks';
import { Star as StarIcon } from 'lucide-react';

import { cn } from '../lib/utils';

interface Vendor {
  _id: string;
  id: number;
  name: string;
  email: string;
  sellerProfile: {
    businessName: string;
    state: string;
    city: string;
    productCategories: string[];
    msmeCategory: string;
    gst: string;
    organizationType: string;
    dateOfIncorporation: string;
    pan: string;
    msmeType?: string;
    vendorType?: string;
    registrationTypes?: string[];
    offices?: any[];
    bankAccounts?: any[];
  };
}

const Vendors = () => {
  const authOptions = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
  const cachedVendors = api.peek('/api/vendors', authOptions);
  const [vendors, setVendors] = useState<Vendor[]>(cachedVendors || []);
  const [loading, setLoading] = useState(!cachedVendors);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [selectedSize, setSelectedSize] = useState('All MSME categories');
  const [selectedStateFilter, setSelectedStateFilter] = useState('All states');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState('All districts');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [viewMode, setViewMode] = useResponsiveViewMode();
  const [sortKey, setSortKey] = useState<'name' | 'region' | 'gst' | 'capability'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal states
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [pressedAction, setPressedAction] = useState<string | null>(null);
  const [openKebabId, setOpenKebabId] = useState<string | number | null>(null);

  useEffect(() => {
    if (!openKebabId) return;
    const handleClickOutside = () => setOpenKebabId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openKebabId]);

  // Quote form state
  const [quoteForm, setQuoteForm] = useState({
    subject: '',
    message: '',
    documentUrl: ''
  });
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [isUploadingQuoteDoc, setIsUploadingQuoteDoc] = useState(false);

  const handleUploadQuoteDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingQuoteDoc(true);
    const optimizedFile = await compressImage(file);
    const formData = new FormData();
    formData.append('file', optimizedFile);

    try {
      const res = await api.fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setQuoteForm(prev => ({ ...prev, documentUrl: data.url }));
        toast.success('Specifications document attached');
      } else {
        toast.error('Upload failed');
      }
    } catch (err) {
      toast.error('Upload error');
    } finally {
      setIsUploadingQuoteDoc(false);
    }
  };

  const categories = [
    'All categories',
    'IT Hardware',
    'Software & Cloud',
    'Office Supplies',
    'Furniture',
    'Industrial Equipment',
    'Medical Supplies',
    'Construction',
    'Logistics',
    'Consulting',
    'Catering'
  ];

  const msmeCategories = [
    'All MSME categories',
    'Micro',
    'Small',
    'Medium',
    'Large'
  ];

  const statesList = [
    'All states', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Jammu & Kashmir', 'Ladakh'
  ];

  const districtOptions = selectedStateFilter === 'All states'
    ? []
    : indiaStatesDistricts[selectedStateFilter.toUpperCase()] || [];

  useEffect(() => {
    let ignore = false;
    async function loadVendors() {
      try {
        const res = await api.get('/api/vendors', authOptions);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) setVendors(data);
        } else {
          if (!ignore) toast.error('Failed to fetch vendors');
        }
      } catch (error) {
        if (!ignore) {
          console.error('Error fetching vendors:', error);
          toast.error('Error connecting to server');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadVendors();
    return () => { ignore = true; };
  }, [authOptions]);

  const vendorActionKey = (vendor: Vendor, action: 'info' | 'quote') => `${action}-${vendor.id || vendor._id}`;

  const pulseVendorAction = (vendor: Vendor, action: 'info' | 'quote') => {
    const key = vendorActionKey(vendor, action);
    setPressedAction(key);
    window.setTimeout(() => {
      setPressedAction(current => current === key ? null : current);
    }, 260);
  };

  const vendorActionClass = (vendor: Vendor, action: 'info' | 'quote') =>
    pressedAction === vendorActionKey(vendor, action)
      ? 'scale-95 ring-2 ring-offset-1 ring-[#12335f]/40 shadow-lg'
      : '';

  const handleViewProfile = async (vendor: Vendor) => {
    pulseVendorAction(vendor, 'info');
    setFetchingDetails(true);
    try {
      const res = await api.get(`/api/vendors/${vendor.id || vendor._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const detailedVendor = await res.json();
        setSelectedVendor(detailedVendor);
        setIsProfileModalOpen(true);
      } else {
        toast.error('Could not load profile details');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleOpenQuoteModal = (vendor: Vendor) => {
    pulseVendorAction(vendor, 'quote');
    setSelectedVendor(vendor);
    setIsQuoteModalOpen(true);
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) return;

    if (!quoteForm.subject.trim() || !quoteForm.message.trim()) {
      toast.error('Please fill in both subject and message requirements');
      return;
    }

    setSubmittingQuote(true);
    try {
      const sellerId = Number(selectedVendor.id || selectedVendor._id);
      const res = await api.post('/api/quotes', {
        sellerId,
        subject: quoteForm.subject,
        message: quoteForm.message,
        documentUrl: quoteForm.documentUrl
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.ok) {
        toast.success(`Quote request & message sent to ${selectedVendor.sellerProfile?.businessName || selectedVendor.name}!`);
        setIsQuoteModalOpen(false);
        const subject = quoteForm.subject;
        setQuoteForm({ subject: '', message: '', documentUrl: '' });
        window.location.href = `/buyer/messages?sellerId=${sellerId}&subject=${encodeURIComponent(subject)}`;
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to send request');
      }
    } catch (error) {
      toast.error('Server error');
    } finally {
      setSubmittingQuote(false);
    }
  };

  const toggleSort = (key: typeof sortKey) => {
    setSortDirection(prev => sortKey === key && prev === 'asc' ? 'desc' : 'asc');
    setSortKey(key);
  };

  const renderSortHeader = (label: string, field: typeof sortKey, align: 'left' | 'right' = 'left') => {
    const isActive = sortKey === field;
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#12335f] hover:text-[#0b2445] transition-colors ${align === 'right' ? 'justify-end' : ''}`}
      >
        {label}
        {isActive ? (
          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    );
  };

  const filteredVendors = vendors.filter(vendor => {
    const profile = vendor.sellerProfile || {};
    const matchesSearch = (profile.businessName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vendor.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All categories' ||
      (profile.productCategories || []).includes(selectedCategory);

    const matchesSize = selectedSize === 'All MSME categories' ||
      (profile.msmeCategory || '') === selectedSize;

    const matchesState = selectedStateFilter === 'All states' ||
      (profile.state || '').toLowerCase() === selectedStateFilter.toLowerCase();

    const profileDistrict = String((profile as any).district || profile.city || '').toLowerCase();
    const matchesDistrict = selectedDistrictFilter === 'All districts' ||
      profileDistrict === selectedDistrictFilter.toLowerCase();

    const matchesVerification = !verifiedOnly || Boolean(profile.gst || profile.pan);
    return matchesSearch && matchesCategory && matchesSize && matchesState && matchesDistrict && matchesVerification;
  }).sort((a, b) => {
    const valueFor = (vendor: Vendor) => {
      const profile = (vendor.sellerProfile || {}) as Partial<Vendor['sellerProfile']>;
      if (sortKey === 'region') return `${profile.state || ''} ${profile.city || ''}`;
      if (sortKey === 'gst') return profile.gst || profile.pan || '';
      if (sortKey === 'capability') return (profile.productCategories || []).join(', ');
      return profile.businessName || vendor.name || '';
    };
    return valueFor(a).localeCompare(valueFor(b)) * (sortDirection === 'asc' ? 1 : -1);
  });
  const { page, pageSize, pageItems: pagedVendors, total, setPage, setPageSize } = usePagination(filteredVendors, 18);

  const kpiData = useMemo(() => {
    let total = vendors.length;
    let verified = vendors.filter(v => v.sellerProfile?.gst || v.sellerProfile?.pan).length;
    let micro = vendors.filter(v => v.sellerProfile?.msmeCategory === 'Micro' || v.sellerProfile?.msmeType === 'MICRO').length;
    let small = vendors.filter(v => v.sellerProfile?.msmeCategory === 'Small' || v.sellerProfile?.msmeType === 'SMALL').length;
    let medium = vendors.filter(v => v.sellerProfile?.msmeCategory === 'Medium' || v.sellerProfile?.msmeType === 'MEDIUM').length;
    const states = new Set(vendors.map(v => v.sellerProfile?.state).filter(Boolean));
    const ratings = vendors.map(v => Number((v as any).sellerProfile?.rating || (v as any).rating || 0)).filter(r => r > 0);
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) + ' ★' : '4.8 ★';
    return {
      total,
      verified,
      msme: micro + small + medium,
      states: states.size,
      avgRating
    };
  }, [vendors]);

  if (loading && vendors.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <GridCardSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transparent Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Supplier Registry</h1>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Registered"
          value={kpiData.total}
          subtext="All supplier profiles"
          icon={Building2}
          color="blue"
          active={!verifiedOnly}
          onClick={() => setVerifiedOnly(false)}
        />
        <KpiCard
          label="Verified MSMEs"
          value={kpiData.verified}
          subtext="GST / PAN verified"
          icon={ShieldCheck}
          color="green"
          active={verifiedOnly}
          onClick={() => setVerifiedOnly(prev => !prev)}
        />
        <KpiCard
          label="States Covered"
          value={kpiData.states}
          subtext="Pan-India network"
          icon={MapPin}
          color="purple"
          active={selectedStateFilter === 'All states'}
          onClick={() => setSelectedStateFilter('All states')}
        />
        <KpiCard
          label="Average Rating"
          value="4.6 ★"
          subtext="Buyer performance score"
          icon={Star}
          color="amber"
          active={false}
        />
      </div>

      {/* ── Search + Filter + View Toggle Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <ResponsiveFilterBar
          activeFilterCount={
            (searchTerm ? 1 : 0) +
            (selectedCategory !== 'All categories' ? 1 : 0) +
            (selectedSize !== 'All MSME categories' ? 1 : 0) +
            (selectedStateFilter !== 'All states' ? 1 : 0) +
            (selectedDistrictFilter !== 'All districts' ? 1 : 0) +
            (verifiedOnly ? 1 : 0)
          }
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by vendor name, city, keyword..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
            </div>
          }
          filters={
            <>
              <div className="w-full sm:w-auto sm:min-w-[130px]">
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[130px]">
                <select
                  value={selectedStateFilter}
                  onChange={e => {
                    setSelectedStateFilter(e.target.value);
                    setSelectedDistrictFilter('All districts');
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  {statesList.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {selectedStateFilter !== 'All states' && (
                <div className="w-full sm:w-auto sm:min-w-[130px]">
                  <select
                    value={selectedDistrictFilter}
                    onChange={e => setSelectedDistrictFilter(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                  >
                    <option value="All districts">All Districts</option>
                    {districtOptions.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="w-full sm:w-auto sm:min-w-[140px]">
                <select
                  value={selectedSize}
                  onChange={e => setSelectedSize(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  {msmeCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setVerifiedOnly(!verifiedOnly)}
                className="flex items-center gap-2 h-10 px-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 shadow-xs cursor-pointer transition-colors"
              >
                <div className={cn("h-4 w-4 rounded-md border flex items-center justify-center transition-all", verifiedOnly ? "bg-[#12335f] border-[#12335f]" : "border-slate-300")}>
                  {verifiedOnly && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>
                <span className="text-xs font-bold text-slate-700 uppercase">Verified Only</span>
              </button>

              {(searchTerm || selectedCategory !== 'All categories' || selectedSize !== 'All MSME categories' || selectedStateFilter !== 'All states' || verifiedOnly) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('All categories');
                    setSelectedSize('All MSME categories');
                    setSelectedStateFilter('All states');
                    setSelectedDistrictFilter('All districts');
                    setVerifiedOnly(false);
                  }}
                  className="h-10 rounded-xl border-rose-200 bg-rose-50/60 text-xs font-extrabold text-rose-700 hover:bg-rose-100 min-w-[80px]"
                >
                  Clear
                </Button>
              )}
            </>
          }
          endContent={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
        />
      </div>

      {/* Results Space */}
      <div className="w-full">
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/30 px-4 py-3 shadow-3xs sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>Found {filteredVendors.length} registered vendors matching criteria</span>}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verified procurement suppliers</span>
        </div>

          {filteredVendors.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
              <div className="h-16 w-16 bg-[#f8f9fa] border border-[#dadce0] rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-[#12335f]/30" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-[#1a1c21]">No results returned</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Try relaxing the search criteria or expanding state selection.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pagedVendors.map((vendor) => (
                <div key={vendor._id} className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start gap-2.5 sm:gap-3 mb-3">
                    <div className="h-10 w-10 shrink-0 rounded bg-[#f1f3f5] border border-[#dadce0] flex items-center justify-center text-[#12335f] font-black text-sm uppercase">
                      {vendor.sellerProfile?.businessName?.charAt(0) || vendor.name?.charAt(0) || 'V'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="font-black text-xs uppercase tracking-tight text-wrap-anywhere text-[#1a1c21]">{vendor.sellerProfile?.businessName || vendor.name}</h3>
                        {vendor.sellerProfile?.gst && <CheckCircle2 className="h-3 w-3 text-[#12335f] shrink-0" />}
                      </div>
                      <div className="mt-1 mb-1">
                        <EntityIdLink label={`VND-${String(vendor.id || vendor._id).padStart(5, '0')}`} id={vendor.id || vendor._id} size="sm" onClick={() => handleViewProfile(vendor)} />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {vendor.sellerProfile?.city || 'City'}, {vendor.sellerProfile?.state || 'State'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {vendor.sellerProfile?.msmeType && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded-full px-2 py-0.5 text-[9px] uppercase font-black tracking-wider">
                        {vendor.sellerProfile.msmeType.replace(/_/g, ' ')}
                      </span>
                    )}
                    {vendor.sellerProfile?.vendorType && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200/50 rounded-full px-2 py-0.5 text-[9px] uppercase font-black tracking-wider">
                        {vendor.sellerProfile.vendorType.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <p title={`Specialized provider in ${(vendor.sellerProfile?.productCategories || []).join(', ') || 'Enterprise Supplies'}. Recognized for reliability.`} className="text-[11px] leading-relaxed text-slate-600 mb-4 flex-1 line-clamp-2 border-t border-b border-[#f1f3f5] py-3 my-2">
                    Specialized provider in {(vendor.sellerProfile?.productCategories || []).join(', ') || 'Enterprise Supplies'}. Recognized for reliability.
                  </p>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase bg-[#f8f9fa] border border-[#dadce0] px-2 py-0.5 rounded">
                      {vendor.sellerProfile?.gst || 'NOT AVAILABLE'}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-black text-[#1a1c21]">
                      <Star className="h-3 w-3 text-amber-500 fill-current" />
                      4.6
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleViewProfile(vendor)}
                      disabled={fetchingDetails}
                      className={cn(
                        "h-8 border border-[#dadce0] text-[#12335f] rounded text-[10px] font-black uppercase tracking-wider hover:bg-[#f8f9fa] hover:border-[#12335f]/40 hover:-translate-y-0.5 active:scale-95 active:translate-y-px transition-all duration-200 flex items-center justify-center disabled:opacity-60 disabled:hover:translate-y-0",
                        vendorActionClass(vendor, 'info')
                      )}
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => handleOpenQuoteModal(vendor)}
                      className={cn(
                        "h-8 bg-[#12335f] text-white rounded text-[10px] font-black uppercase tracking-wider hover:bg-[#0b2445] hover:-translate-y-0.5 active:scale-95 active:translate-y-px shadow-sm shadow-[#12335f]/20 transition-all duration-200 flex items-center justify-center",
                        vendorActionClass(vendor, 'quote')
                      )}
                    >
                      Request Quote
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* LIST VIEW (Table style high density) */
            <div className="overflow-x-auto bg-white border border-slate-200/80 rounded-2xl shadow-sm">
              <div className="overflow-x-auto w-full rounded-xl border border-slate-200 bg-white mb-6 shadow-sm">
<table data-ux-wrapped="true" className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-[#f8f9fa] border-b border-[#dadce0]">
                  <tr>
                    <th className="p-3 text-[10px] font-black uppercase tracking-wider text-[#12335f]">Sr. No.</th>
                    <th className="p-3">{renderSortHeader('Vendor Identity', 'name')}</th>
                    <th className="p-3">{renderSortHeader('Region', 'region')}</th>
                    <th className="p-3">{renderSortHeader('Registration (GST)', 'gst')}</th>
                    <th className="p-3">{renderSortHeader('Capability', 'capability')}</th>
                    <th className="p-3 text-right text-[10px] font-black uppercase tracking-wider text-[#12335f]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f3f5]">
                  {pagedVendors.map((vendor, index) => (
                    <tr key={vendor._id} className="hover:bg-[#fcfcfd] transition-colors">
                      <td className="p-3 font-mono text-[11px] font-black text-slate-400">{String((page - 1) * pageSize + index + 1).padStart(2, '0')}</td>
                      <td className="p-3">
                        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center w-full sm:w-auto">
                          <div className="h-8 w-8 rounded bg-[#f1f3f5] border border-[#dadce0] flex items-center justify-center text-[#12335f] font-black text-xs shrink-0">
                            {vendor.sellerProfile?.businessName?.charAt(0) || 'V'}
                          </div>
                          <div>
                            <p className="font-black text-xs uppercase tracking-tight text-[#1a1c21] text-wrap-anywhere">{vendor.sellerProfile?.businessName || vendor.name}</p>
                            <div className="mt-1">
                              <EntityIdLink label={`VND-${String(vendor.id || vendor._id).padStart(5, '0')}`} id={vendor.id || vendor._id} size="sm" onClick={() => handleViewProfile(vendor)} />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[9px] font-bold text-[#12335f] uppercase">
                                {vendor.sellerProfile?.msmeCategory || 'Registered'} Enterprise
                              </p>
                              {vendor.sellerProfile?.msmeType && (
                                <span className="bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded text-[8px] uppercase font-black">
                                  {vendor.sellerProfile.msmeType.replace(/_/g, ' ')}
                                </span>
                              )}
                              {vendor.sellerProfile?.vendorType && (
                                <span className="bg-blue-50 text-blue-700 px-1 py-0.2 rounded text-[8px] uppercase font-black">
                                  {vendor.sellerProfile.vendorType.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-[11px] font-bold text-slate-600 uppercase">
                        {vendor.sellerProfile?.city || 'N/A'}, {vendor.sellerProfile?.state || 'N/A'}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-mono font-bold text-slate-600 uppercase bg-[#f1f3f5] border border-[#dadce0] px-2 py-0.5 rounded inline-block">
                          {vendor.sellerProfile?.gst || 'PENDING'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {(vendor.sellerProfile?.productCategories || []).slice(0, 2).map(c => (
                            <span key={c} className="text-[9px] font-bold text-slate-500 border border-[#dadce0] rounded px-1.5 py-0.5 uppercase">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="relative inline-flex items-center justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const vid = vendor.id || vendor._id;
                              setOpenKebabId(openKebabId === vid ? null : vid);
                            }}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs focus:outline-none"
                            title="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openKebabId === (vendor.id || vendor._id) && (
                            <div className="absolute right-0 top-full mt-1.5 z-40 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 flex flex-col gap-0.5 text-left animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenKebabId(null);
                                  handleViewProfile(vendor);
                                }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors text-left"
                              >
                                <Info className="h-3.5 w-3.5 text-slate-500" />
                                <span>View Info</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenKebabId(null);
                                  handleOpenQuoteModal(vendor);
                                }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-black rounded-lg text-[#12335f] hover:bg-blue-50 transition-colors text-left"
                              >
                                <FileText className="h-3.5 w-3.5 text-[#12335f]" />
                                <span>Request Quote</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
</div>
            </div>
          )}
          {filteredVendors.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#dadce0] bg-white">
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="vendors" />
            </div>
          )}
        </div>

      {/* Vendor Profile Modal */}
      {isProfileModalOpen && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center w-full sm:w-auto">
                <div className="h-11 w-11 rounded-xl bg-[#12335f] flex items-center justify-center text-white font-black text-xl shadow shadow-slate-900/10">
                  {selectedVendor.sellerProfile?.businessName?.charAt(0) || selectedVendor.name?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    {selectedVendor.sellerProfile?.businessName || selectedVendor.name}
                    <CheckCircle2 className="h-4 w-4 text-[#12335f]" />
                  </h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{selectedVendor.sellerProfile?.organizationType || 'Private Limited'} · {selectedVendor.sellerProfile?.msmeCategory || 'Medium'} Enterprise</p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
                <VendorRatingTile sellerId={Number(selectedVendor.id)} />
                {[
                  { label: 'City', value: selectedVendor.sellerProfile?.city || selectedVendor.sellerProfile?.offices?.find((o: any) => o.gstNumber)?.city || selectedVendor.sellerProfile?.offices?.[0]?.city || 'N/A', icon: MapPin, color: 'text-blue-500' },
                  { label: 'Established', value: selectedVendor.sellerProfile?.dateOfIncorporation ? new Date(selectedVendor.sellerProfile.dateOfIncorporation).getFullYear() : '2018', icon: Building2, color: 'text-teal-500' },
                  { label: 'PAN Verified', value: 'Yes', icon: ShieldCheck, color: 'text-emerald-500' }
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <stat.icon className={`h-3 w-3 ${stat.color}`} />
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{stat.label}</span>
                    </div>
                    <div className="text-xs font-black text-slate-900 uppercase">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Bio/Info */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase text-[#12335f] tracking-[0.1em] flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  Business Overview
                </h3>
                <p className="text-xs font-medium text-slate-600 leading-relaxed border-l-2 border-slate-200 pl-4 py-0.5">
                  {selectedVendor.sellerProfile?.businessName || selectedVendor.name} is a leading provider in the {selectedVendor.sellerProfile?.productCategories?.[0] || 'MSME'} sector, specializing in high-quality deliverables for enterprise-grade procurement. With a focus on compliance and efficiency, we ensure seamless supply chain integration for our buyer partners.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Business Details */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em]">Business Details</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'GST Number', value: selectedVendor.sellerProfile?.gst, icon: FileText },
                      { label: 'Business PAN', value: selectedVendor.sellerProfile?.pan, icon: Briefcase },
                      { label: 'Email Address', value: selectedVendor.email, icon: Mail },
                      { label: 'Incorporation', value: selectedVendor.sellerProfile?.dateOfIncorporation ? new Date(selectedVendor.sellerProfile.dateOfIncorporation).toLocaleDateString() : 'N/A', icon: Clock },
                      { label: 'MSME Type', value: selectedVendor.sellerProfile?.msmeType?.replace(/_/g, ' '), icon: Building2 },
                      { label: 'Vendor Type', value: selectedVendor.sellerProfile?.vendorType?.replace(/_/g, ' '), icon: Briefcase }
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2.5 sm:gap-3 group font-medium">
                        <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#12335f] transition-colors">
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{item.label}</p>
                          <p className="text-xs font-bold text-slate-800">{item.value || 'Verified'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Categories & Offices */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em]">Categories & Reach</h3>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedVendor.sellerProfile?.productCategories?.map(cat => (
                        <span key={cat} className="px-2 py-1 rounded-md bg-slate-50 text-[#12335f] text-[10px] font-black uppercase border border-slate-200">
                          {cat}
                        </span>
                      ))}
                    </div>
                    {selectedVendor.sellerProfile?.registrationTypes && selectedVendor.sellerProfile.registrationTypes.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Certifications / Registrations</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedVendor.sellerProfile.registrationTypes.map((reg: string) => (
                            <span key={reg} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase border border-emerald-100">
                              {reg.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Registered Offices</p>
                      {selectedVendor.sellerProfile?.offices && selectedVendor.sellerProfile.offices.length > 0 ? (
                        <div className="space-y-2">
                          {selectedVendor.sellerProfile.offices.map((office: any) => (
                            <div key={office.id} className="flex gap-2">
                              <MapPin className="h-3.5 w-3.5 text-[#12335f] mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-slate-800">{office.name}</p>
                                <p className="text-[10px] text-slate-500">{office.address}, {office.city}, {office.state}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-medium">{selectedVendor.sellerProfile?.city || selectedVendor.sellerProfile?.offices?.[0]?.city || 'N/A'}, {selectedVendor.sellerProfile?.state || selectedVendor.sellerProfile?.offices?.[0]?.state || 'N/A'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5 sm:gap-3">
              <Button
                variant="outline"
                onClick={() => setIsProfileModalOpen(false)}
                className="rounded-lg h-9 px-5 font-bold uppercase text-[11px] tracking-wider text-slate-600 hover:text-slate-900 border-slate-200"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setIsProfileModalOpen(false);
                  setIsQuoteModalOpen(true);
                }}
                className="bg-[#12335f] hover:bg-[#0b2445] text-white rounded-lg h-9 px-5 font-bold uppercase text-[11px] tracking-wider shadow shadow-slate-200"
              >
                Request Quote
              </Button>
            </div>
          </div>
        </div>
      )}

      {isQuoteModalOpen && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-black text-lg border border-white/20">
                  {selectedVendor.sellerProfile?.businessName?.charAt(0) || selectedVendor.name?.charAt(0) || 'S'}
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Request Quote & Chat
                  </h3>
                  <p className="text-[11px] font-medium text-slate-300">
                    To: {selectedVendor.sellerProfile?.businessName || selectedVendor.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQuoteModalOpen(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmitQuote} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Requirement / Quote Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bulk Requirement for IT Hardware & Networking Equipment"
                  value={quoteForm.subject}
                  onChange={e => setQuoteForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Message / Detailed Specifications <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your requirement, quantity needed, preferred delivery timeline, or any specific details for the supplier..."
                  value={quoteForm.message}
                  onChange={e => setQuoteForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20 focus:bg-white transition-all"
                />
              </div>

              {/* Specification Document Attachment */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Attach Specifications / RFQ File (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors text-xs font-bold text-slate-700">
                    {isUploadingQuoteDoc ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#12335f]" />
                    ) : (
                      <Paperclip className="h-4 w-4 text-slate-500" />
                    )}
                    <span>{isUploadingQuoteDoc ? 'Uploading...' : 'Choose File'}</span>
                    <input
                      type="file"
                      onChange={handleUploadQuoteDoc}
                      className="hidden"
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    />
                  </label>
                  {quoteForm.documentUrl && (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> File attached
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const sellerId = selectedVendor.id || selectedVendor._id;
                    const subject = encodeURIComponent(quoteForm.subject || `Supplier inquiry: ${selectedVendor.sellerProfile?.businessName || selectedVendor.name}`);
                    window.location.href = `/buyer/messages?sellerId=${sellerId}&subject=${subject}`;
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 h-9 border border-slate-200 rounded-lg text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#12335f]" />
                  Open Direct Chat
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsQuoteModalOpen(false)}
                    className="h-9 px-4 text-xs font-bold uppercase"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingQuote || isUploadingQuoteDoc}
                    className="h-9 px-5 bg-[#12335f] hover:bg-[#0b2445] text-white font-bold uppercase text-xs shadow-sm flex items-center gap-2"
                  >
                    {submittingQuote ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send & Start Chat
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function VendorRatingTile({ sellerId }: { sellerId: number }) {
  const summary = useSupplierSummary(sellerId);
  const value = summary.data && summary.data.count > 0
    ? `${summary.data.average.toFixed(1)} / 5`
    : 'New';
  const sublabel = summary.data && summary.data.count > 0
    ? `${summary.data.count} ratings`
    : 'No ratings yet';
  return (
    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
      <div className="flex items-center gap-2 mb-1">
        <StarIcon className="h-3 w-3 text-amber-500" />
        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Rating</span>
      </div>
      <div className="text-xs font-black text-slate-900 uppercase">{value}</div>
      <div className="text-[9px] font-bold text-slate-500 uppercase">{sublabel}</div>
    </div>
  );
}



function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-slate-800">{value || '-'}</p>
    </div>
  );
}

export default Vendors;
