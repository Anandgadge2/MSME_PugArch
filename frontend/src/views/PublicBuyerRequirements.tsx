import React, { useEffect, useState } from 'react';
import { api, resolveMediaUrl } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Building2,
  MapPin,
  Search,
  ArrowLeft,
  Download,
  CheckCircle2,
  Globe,
  Phone,
  Mail,
  AlertTriangle,
  FileSpreadsheet,
  Copy,
  ExternalLink,
  Layers,
  PackageCheck,
  Sparkles,
  X,
  ShieldCheck,
  Hash,
  Briefcase,
  Tag,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsv } from '../features/shared/exportUtils';
import { Pagination } from '../features/shared/Pagination';

interface PublicBuyerRequirementsProps {
  buyerId: number;
}

export default function PublicBuyerRequirements({ buyerId }: PublicBuyerRequirementsProps) {
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchProfile = async () => {
    try {
      const res = await api.fetch(`/api/buyer-showcase/public/organizations/${buyerId}`);
      if (res.ok) {
        const body = await res.json();
        setProfile(body.data);
      } else {
        toast.error('Failed to load organization profile');
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
      toast.error('Network error loading profile');
    }
  };

  const fetchItems = async () => {
    setItemsLoading(true);
    try {
      const query = new URLSearchParams();
      if (searchTerm) query.append('search', searchTerm);
      if (selectedCategory) query.append('category', selectedCategory);

      const res = await api.fetch(`/api/buyer-showcase/public/organizations/${buyerId}/items?${query.toString()}`);
      if (res.ok) {
        const body = await res.json();
        const itemsList = body.data || [];
        setItems(itemsList);

        // Extract unique categories from items for filtering if categories not already set
        if (categories.length === 0) {
          const uniqueCats: string[] = Array.from(
            new Set(itemsList.map((item: any) => item.category).filter(Boolean))
          ) as string[];
          setCategories(uniqueCats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch items', err);
    } finally {
      setItemsLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [buyerId]);

  useEffect(() => {
    fetchItems();
    setCurrentPage(1); // Reset page on filter change
  }, [buyerId, searchTerm, selectedCategory]);

  const handleExportCSV = () => {
    if (items.length === 0) {
      toast.error('No items to export');
      return;
    }

    const headers = ['Serial No', 'Item Description', 'Category', 'Estimated Monthly Qty', 'Unit', 'Remarks'];
    const rows = items.map(item => [
      item.serialNo || '',
      item.itemDescription || '',
      item.category || '',
      item.estimatedMonthlyRequirement || '',
      item.unit || '',
      item.remarks || ''
    ]);

    downloadCsv(`${profile?.organizationName?.replace(/\s+/g, '_') || 'buyer'}_requirements.csv`, [headers, ...rows]);
    toast.success('Requirements list downloaded successfully');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = items.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(items.length / itemsPerPage);

  // Helper for category badge color palette
  const getCategoryColor = (category: string) => {
    const palette = [
      'bg-blue-50 text-blue-700 border-blue-200',
      'bg-indigo-50 text-indigo-700 border-indigo-200',
      'bg-purple-50 text-purple-700 border-purple-200',
      'bg-emerald-50 text-emerald-700 border-emerald-200',
      'bg-teal-50 text-teal-700 border-teal-200',
      'bg-amber-50 text-amber-800 border-amber-200',
      'bg-rose-50 text-rose-700 border-rose-200'
    ];
    let hash = 0;
    for (let i = 0; i < (category?.length || 0); i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          <div className="h-12 w-12 rounded-full border-4 border-blue-100 border-t-[#0f3460] animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-[#0f3460]">Loading Verified Organization...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200/80 flex flex-col items-center max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-5">
            <Building2 className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">Showcase Not Available</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            The requested buyer profile is not verified, not active, or does not exist.
          </p>
          <Button
            onClick={() => window.location.href = '/'}
            className="mt-6 bg-[#0f3460] hover:bg-[#16213e] text-white font-black uppercase text-[11px] tracking-widest h-11 px-6 rounded-2xl shadow-lg transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-blue-50/20 text-slate-900 pb-24 relative selection:bg-blue-500 selection:text-white">
      {/* 3-Color Flag Accent Strip */}
      <div className="brand-tricolor-strip w-full fixed top-0 left-0 z-50 h-1.5 bg-gradient-to-r from-orange-500 via-amber-300 to-emerald-600 shadow-sm" />

      {/* Top Floating Navigation Bar */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/70 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <Button
          onClick={() => window.history.back()}
          className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 font-black uppercase text-[11px] tracking-wider h-9 px-4 rounded-xl shadow-xs border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-blue-600" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Official Buyer Showcase
          </span>
        </div>
      </div>

      {/* Full Hero Cover Banner (Properly Visible, No Dark Muddy Gradients) */}
      <div className="w-full relative bg-[#0b2447] overflow-hidden border-b border-slate-200/60 shadow-inner">
        {profile.bannerUrl ? (
          <div className="w-full relative min-h-[220px] sm:min-h-[280px] md:min-h-[340px] lg:min-h-[400px] flex items-center justify-center bg-slate-900">
            <img
              src={resolveMediaUrl(profile.bannerUrl) || ''}
              alt={`${profile.organizationName} Banner`}
              className="w-full h-full object-cover sm:object-contain md:object-cover max-h-[440px] transition-transform duration-700"
            />
            {/* Very subtle edge gradient to ensure smooth transition to page content */}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          </div>
        ) : (
          <div className="w-full min-h-[240px] md:min-h-[300px] bg-gradient-to-r from-[#0b2447] via-[#12335f] to-[#1e40af] relative overflow-hidden flex items-center">
            {/* Geometric glow accents */}
            <div className="absolute -right-20 -top-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="max-w-7xl mx-auto px-6 py-12 w-full relative z-10">
              <div className="inline-flex items-center gap-2 bg-blue-400/20 border border-blue-300/30 text-blue-100 rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-md mb-3">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                Verified Organization Portal
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight drop-shadow-md">
                {profile.organizationName}
              </h1>
              {profile.departmentName && profile.departmentName !== 'N/A' && (
                <p className="text-sm md:text-base font-bold text-blue-200/90 mt-2 uppercase tracking-wide">
                  {profile.departmentName}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 relative z-10">
        
        {/* Quick Stats & Highlights Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-blue-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Requirements</span>
              <span className="text-lg font-black text-slate-900">{items.length} Items</span>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-purple-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Categories</span>
              <span className="text-lg font-black text-slate-900">{categories.length || 'General'}</span>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-teal-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Org Type</span>
              <span className="text-sm font-black text-slate-900 truncate block max-w-[130px]" title={profile.organizationType}>
                {profile.organizationType?.replace(/_/g, ' ') || 'Enterprise'}
              </span>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-emerald-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Verification</span>
              <span className="text-sm font-black text-emerald-700">Verified Buyer</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          
          {/* Left Column: Organization Profile Card (No Box around Logo, 2X Size) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl border border-slate-200/90 shadow-md bg-white overflow-hidden relative">
              {/* Decorative top accent gradient bar */}
              <div className="h-2.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500" />
              
              <div className="p-6 md:p-8 flex flex-col items-center text-center">
                
                {/* 2X Logo Display - Completely Unboxed, Clean & Prominent */}
                <div className="w-full flex items-center justify-center py-4 mb-3">
                  {profile.logoUrl ? (
                    <img
                      src={resolveMediaUrl(profile.logoUrl) || ''}
                      alt={`${profile.organizationName} Logo`}
                      className="max-h-36 sm:max-h-40 w-auto max-w-[260px] object-contain transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white shadow-lg">
                      <Building2 className="w-14 h-14" />
                    </div>
                  )}
                </div>

                {/* Verified Badge */}
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3.5 py-1 text-[10px] font-black uppercase tracking-wider mb-3 shadow-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Verified Buyer Organization
                </div>

                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-snug uppercase">
                  {profile.organizationName}
                </h2>
                
                {profile.departmentName && profile.departmentName !== 'N/A' && (
                  <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-lg">
                    {profile.departmentName}
                  </p>
                )}

                <div className="w-full border-t border-slate-100 my-5" />

                {/* Detailed Organization Meta Attributes */}
                <div className="w-full space-y-4 text-left">
                  {profile.organizationType && profile.organizationType !== 'N/A' && (
                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100/90 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Organization Type</span>
                        <span className="font-extrabold text-slate-800 text-xs">{profile.organizationType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                      </div>
                    </div>
                  )}

                  {profile.registrationNumber && profile.registrationNumber !== 'N/A' && (
                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100/90 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Hash className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Registration (CIN)</span>
                          <span className="font-extrabold text-slate-900 font-mono text-xs break-all">{profile.registrationNumber}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(profile.registrationNumber, 'CIN')}
                        className="text-slate-400 hover:text-purple-700 p-1 rounded-lg hover:bg-purple-50 transition-colors"
                        title="Copy CIN"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {profile.address && profile.address !== 'N/A' && (
                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100/90 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-100/80 text-cyan-700 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Registered Address</span>
                        <span className="font-bold text-slate-700 leading-relaxed block text-xs">
                          {profile.address}
                          {(profile.city && profile.city !== 'N/A') || (profile.state && profile.state !== 'N/A') || (profile.pincode && profile.pincode !== 'N/A') ? (
                            <span className="block mt-1 text-slate-500 font-semibold">
                              {[profile.city, profile.state, profile.pincode].filter(v => v && v !== 'N/A').join(', ')}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </div>
                  )}

                  {profile.website && (
                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100/90 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Official Website</span>
                        <a
                          href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs hover:underline"
                        >
                          {profile.website}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {profile.officialEmail && profile.officialEmail !== 'N/A' && (
                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100/90 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Official Email</span>
                        <a href={`mailto:${profile.officialEmail}`} className="font-bold text-slate-700 hover:text-amber-700 text-xs">
                          {profile.officialEmail}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Disclaimer + Rich Table Showcase */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Informational Disclaimer Notice (Vibrant Amber & Gold Card) */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50 border border-amber-200/90 rounded-3xl p-5 md:p-6 flex items-start gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">Official Portal Information Notice</h4>
                  <span className="bg-amber-200/70 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">Advisory</span>
                </div>
                <p className="text-xs text-amber-950/90 leading-relaxed font-semibold">
                  This list represents verified recurring procurement requirements uploaded by {profile.organizationName}. It is intended for supplier awareness and catalog alignment. It is not an active tender, RFQ, or purchase order.
                </p>
              </div>
            </div>

            {/* Showcase Items Grid & Filter */}
            <Card className="rounded-3xl border border-slate-200/90 shadow-md bg-white overflow-hidden">
              <CardContent className="p-6 md:p-8 space-y-6">
                
                {/* Header & Export Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">Frequently Bought Requirements</h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        Showing {items.length} verified item{items.length !== 1 ? 's' : ''} in total
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleExportCSV}
                    className="bg-gradient-to-r from-[#0f3460] to-[#1e40af] hover:from-[#16213e] hover:to-indigo-900 text-white font-black uppercase text-[11px] tracking-wider h-10 px-5 rounded-xl flex items-center justify-center shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {/* Filter and Search Controls */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative sm:col-span-2">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-blue-500 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search items by description or keyword..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder-slate-400 shadow-xs"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-xs cursor-pointer"
                      >
                        <option value="">All Categories ({categories.length})</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Category Quick Filter Chips */}
                  {categories.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                        <Filter className="h-3 w-3" /> Quick Filter:
                      </span>
                      <button
                        onClick={() => setSelectedCategory('')}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                          selectedCategory === ''
                            ? 'bg-[#0f3460] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All
                      </button>
                      {categories.slice(0, 5).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                            selectedCategory === cat
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                  <table className="w-full border-collapse text-left text-xs font-semibold text-slate-700">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-100 via-blue-50/50 to-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                        <th className="p-4 w-16 text-center">Sl.</th>
                        <th className="p-4">Item Description</th>
                        <th className="p-4 w-36">Category</th>
                        <th className="p-4 w-36 text-center">Monthly Requirement</th>
                        <th className="p-4 w-24 text-center">Unit</th>
                        <th className="p-4 w-44">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsLoading ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center bg-slate-50/30">
                            <div className="flex flex-col items-center gap-3">
                              <div className="h-8 w-8 rounded-full border-3 border-blue-200 border-t-blue-600 animate-spin" />
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtering items...</span>
                            </div>
                          </td>
                        </tr>
                      ) : currentItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center bg-slate-50/30">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                                <Search className="h-6 w-6" />
                              </div>
                              <p className="text-slate-700 font-extrabold text-sm uppercase">No Requirements Found</p>
                              <p className="text-xs text-slate-400 font-medium">Try clearing your search term or selecting a different category.</p>
                              {(searchTerm || selectedCategory) && (
                                <Button
                                  onClick={() => { setSearchTerm(''); setSelectedCategory(''); }}
                                  variant="outline"
                                  className="mt-3 text-xs font-bold h-8 rounded-xl"
                                >
                                  Clear Filters
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        currentItems.map((item, index) => (
                          <tr
                            key={item.id || index}
                            className="hover:bg-blue-50/40 transition-colors group"
                          >
                            <td className="p-4 text-center">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-800 text-[11px] font-bold">
                                {item.serialNo || (indexOfFirstItem + index + 1)}
                              </span>
                            </td>
                            <td className="p-4 font-black text-slate-900 max-w-xs break-words">
                              <div className="leading-snug">{item.itemDescription}</div>
                            </td>
                            <td className="p-4">
                              {item.category ? (
                                <span className={`inline-block rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border ${getCategoryColor(item.category)}`}>
                                  {item.category}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium italic">Uncategorized</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {item.estimatedMonthlyRequirement ? (
                                <span className="inline-block bg-blue-50/80 text-blue-900 border border-blue-200/80 px-2.5 py-0.5 rounded-md font-black text-xs">
                                  {item.estimatedMonthlyRequirement}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="p-4 text-center font-bold text-slate-600">
                              {item.unit || '-'}
                            </td>
                            <td className="p-4 text-slate-500 font-medium max-w-xs truncate text-xs" title={item.remarks}>
                              {item.remarks || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {!itemsLoading && items.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <Pagination
                      page={currentPage}
                      pageSize={itemsPerPage}
                      total={items.length}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={setItemsPerPage}
                      label="items"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
