'use client';

import React, { useState, useEffect } from 'react';
import { Images, LayoutList, Sparkles } from 'lucide-react';
import AdminBannerManagementPage from '../../banners/pages/AdminBannerManagementPage';
import AdminMarketplaceHomeSectionsPage from '../../marketplace/pages/AdminMarketplaceHomeSectionsPage';

type CmsTab = 'banners' | 'sections';

export default function AdminCmsHubPage() {
  const [activeTab, setActiveTab] = useState<CmsTab>('banners');

  // Read tab parameter from URL search params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'sections') {
        setActiveTab('sections');
      } else if (tabParam === 'banners') {
        setActiveTab('banners');
      }
    }
  }, []);

  const handleTabChange = (tab: CmsTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div className="mx-auto max-w-[1560px] space-y-6 px-4 pb-12">
      {/* CMS Hub Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-950">CMS & Content Management</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-[#12335f] border border-blue-200">
              <Sparkles className="h-3 w-3 text-blue-600" />
              Unified Content Hub
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Centrally manage public portal banners, announcements, discovery sequences, and marketplace featured sections.
          </p>
        </div>
      </div>

      {/* Accessible Interactive Tab Navigation (WCAG 2.1 AA) */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-4 overflow-x-auto pb-1" role="tablist" aria-label="CMS Hub Sections">
          {[
            {
              id: 'banners' as const,
              label: 'Banners & Announcements',
              icon: Images,
              description: 'Carousel banners, organization promos, and alerts'
            },
            {
              id: 'sections' as const,
              label: 'Marketplace & Homepage Sections',
              icon: LayoutList,
              description: 'Discovery rails, automated & curated product shelves'
            }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`cms-tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`cms-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2.5 whitespace-nowrap border-b-2 px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition outline-none focus-visible:ring-2 focus-visible:ring-[#12335f] ${
                  isSelected
                    ? 'border-[#12335f] text-[#12335f] font-black'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? 'text-[#12335f]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === 'banners' && (
        <div
          id="cms-panel-banners"
          role="tabpanel"
          aria-labelledby="cms-tab-banners"
          className="animate-in fade-in duration-300"
        >
          <AdminBannerManagementPage />
        </div>
      )}

      {activeTab === 'sections' && (
        <div
          id="cms-panel-sections"
          role="tabpanel"
          aria-labelledby="cms-tab-sections"
          className="animate-in fade-in duration-300"
        >
          <AdminMarketplaceHomeSectionsPage />
        </div>
      )}
    </div>
  );
}
