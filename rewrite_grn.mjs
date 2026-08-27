import fs from 'fs';
import path from 'path';

const filePath = path.join('frontend', 'src', 'features', 'grn', 'pages', 'GrnListPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 0. Fix imports
content = content.replace("import { InfoTile } from './InfoTile';", "");

// 1. Rewrite the Top Header block (remove ViewModeToggle and New GRN)
const headerStart = content.indexOf('{/* Transparent Header */}');
const headerEnd = content.indexOf('{/* KPI Cards Grid */}');

if (headerStart !== -1 && headerEnd !== -1) {
    const newHeader = `{/* Transparent Header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
                <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f] bg-[#12335f]/10 px-2.5 py-1 rounded-full">Fulfillment</span>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">Goods Receipt Notes</h1>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                        Record received goods, run inspection, approve to trigger seller invoice.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" onClick={() => refetch()} className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm">
                        <RefreshCw className={cn("mr-2 h-4 w-4 text-[#12335f]", isFetching && "animate-spin")} /> Refresh
                    </Button>
                </div>
            </div>

            `;
    content = content.substring(0, headerStart) + newHeader + content.substring(headerEnd);
}

// 2. Rewrite the ResponsiveFilterBar block
const filterBarStart = content.indexOf('<ResponsiveFilterBar');
const filterBarEnd = content.indexOf('{/* Active Filter Chips */}');

if (filterBarStart !== -1 && filterBarEnd !== -1) {
    const newFilterBar = `
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full">
                    {/* Search */}
                    <div className="flex-[1_1_auto] min-w-[240px] relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={event => { setSearch(event.target.value); setPage(1); }}
                            placeholder="Search GRN, PO, seller, receiver, status..."
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
                        />
                    </div>

                    {/* Status */}
                    <div className="flex-[0_0_auto] w-full sm:w-[130px]">
                        <select value={filter} onChange={e => { setFilter(e.target.value as any); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-xs cursor-pointer transition-colors">
                            <option value="ALL">Status: All</option>
                            <option value="DRAFT">Draft</option>
                            <option value="SUBMITTED">Submitted</option>
                            <option value="APPROVED">Approved</option>
                            <option value="PARTIAL">Partial</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    {/* PO */}
                    <div className="flex-[0_0_auto] w-full sm:w-[135px]">
                        <select value={filterPo} onChange={e => { setFilterPo(e.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-xs cursor-pointer transition-colors truncate">
                            <option value="ALL">PO: All</option>
                            {uniquePos.map(po => <option key={po} value={po}>{po.length > 20 ? po.substring(0, 20) + '...' : po}</option>)}
                        </select>
                    </div>

                    {/* Seller */}
                    <div className="flex-[0_0_auto] w-full sm:w-[135px]">
                        <select value={filterSeller} onChange={e => { setFilterSeller(e.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-xs cursor-pointer transition-colors truncate">
                            <option value="ALL">Seller: All</option>
                            {uniqueSellers.map(s => <option key={s} value={s}>{s.length > 20 ? s.substring(0, 20) + '...' : s}</option>)}
                        </select>
                    </div>

                    {/* Items */}
                    <div className="flex-[0_0_auto] w-full sm:w-[110px]">
                        <select value={filterItems} onChange={e => { setFilterItems(e.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-xs cursor-pointer transition-colors">
                            <option value="ALL">Items: All</option>
                            <option value="1">1 line</option>
                            <option value="2">2 lines</option>
                            <option value="3+">3+ lines</option>
                        </select>
                    </div>

                    {/* Date Filter Component */}
                    <div className="flex-[0_0_auto] w-full sm:w-[130px]">
                        <DateFilterPopover 
                            receivedFrom={filterReceivedFrom} setReceivedFrom={(v) => { setFilterReceivedFrom(v); setPage(1); }}
                            receivedTo={filterReceivedTo} setReceivedTo={(v) => { setFilterReceivedTo(v); setPage(1); }}
                            updatedFrom={filterUpdatedFrom} setUpdatedFrom={(v) => { setFilterUpdatedFrom(v); setPage(1); }}
                            updatedTo={filterUpdatedTo} setUpdatedTo={(v) => { setFilterUpdatedTo(v); setPage(1); }}
                            activeCount={(filterReceivedFrom || filterReceivedTo ? 1 : 0) + (filterUpdatedFrom || filterUpdatedTo ? 1 : 0)}
                            clearDates={() => {
                                setFilterReceivedFrom('');
                                setFilterReceivedTo('');
                                setFilterUpdatedFrom('');
                                setFilterUpdatedTo('');
                                setPage(1);
                            }}
                        />
                    </div>

                    {/* Right Actions */}
                    <div className="flex-[0_0_auto] flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                        {activeFilterCount > 0 && (
                            <Button
                                variant="ghost"
                                onClick={clearFilters}
                                className="h-9 px-2 text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 shrink-0 hidden lg:inline-flex"
                            >
                                Clear Filters
                            </Button>
                        )}
                        <div className="shrink-0 flex items-center gap-2 ml-auto">
                            <ViewModeToggle value={viewMode} onChange={setViewMode} />
                            {canCreate && (
                                <Button onClick={() => setShowCreate(true)} className="h-10 bg-[#12335f] text-white hover:bg-[#0e2a4f] text-xs font-black uppercase rounded-lg shadow-sm whitespace-nowrap px-4 shrink-0 transition-all hover:-translate-y-[1px] active:scale-[0.98]">
                                    <Plus className="mr-1.5 h-4 w-4 shrink-0" /> New GRN
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                `;
    content = content.substring(0, filterBarStart) + newFilterBar + content.substring(filterBarEnd);
}

// 3. Clean up the outer div padding
const wrapperRegex = /<div className=\{cn\("rounded-2xl border border-slate-200\/90 bg-white p-3 sm:p-4 shadow-sm", activeFilterCount > 0 \? "space-y-3" : ""\)\}>/;
content = content.replace(wrapperRegex, '<div className={cn("rounded-[18px] border border-slate-200/90 bg-white p-3 shadow-sm", activeFilterCount > 0 ? "space-y-3" : "")}>');

// 4. Fix EmptyState action
content = content.replace(
    /action=\{\s*<Button onClick=\{clearFilters\} className="mt-4 bg-\[#12335f\] text-white hover:bg-\[#0e2a4f\] text-xs font-black uppercase tracking-wider rounded-lg shadow-sm">\s*Clear Filters\s*<\/Button>\s*\}/g,
    "action={{ label: 'Clear Filters', onClick: clearFilters }}"
);

fs.writeFileSync(filePath, content);
console.log('Done!');
