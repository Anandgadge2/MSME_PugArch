import fs from 'fs';

let content = fs.readFileSync('frontend/src/features/delivery/pages/DeliveryListPage.tsx', 'utf8');

// 1. Add usePagination
content = content.replace(
  "import { useResponsiveViewMode } from '../../shared/hooks';",
  "import { usePagination, useResponsiveViewMode } from '../../shared/hooks';"
);

// 2. Remove old state
const stateStart = content.indexOf('  const [page, setPage] = useState(1);');
const stateEnd = content.indexOf('const handleSort = (key: string) => {');
if (stateStart !== -1 && stateEnd !== -1) {
  content = content.substring(0, stateStart) + 
`  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [orderFilter, setOrderFilter] = useState('All Orders');
  const [carrierFilter, setCarrierFilter] = useState('All Carriers');
  const [amountFilter, setAmountFilter] = useState('All Values');
  const [expectedDateFilter, setExpectedDateFilter] = useState('All Dates');
  const [customDate, setCustomDate] = useState({ start: '', end: '' });
  const [activeKpiFilter, setActiveKpiFilter] = useState('all');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useResponsiveViewMode();
  const [sortKey, setSortKey] = useState<string>('updated_desc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  ` + content.substring(stateEnd);
}

// 3. Fix handleSort
content = content.replace(
  "setSortDir(key === 'order' || key === 'parties' || key === 'carrier' ? 'asc' : 'desc');",
  "setSortDir(key === 'order' || key === 'parties' || key === 'carrier' || key === 'tracking' ? 'asc' : 'desc');"
);

// 4. Remove Debounced search and old listQuery
const queryStart = content.indexOf('  // Debounced search to avoid hammering the API on every keystroke.');
const recordsEnd = content.indexOf('}, [rawRecords, sortKey, sortDir]);') + '}, [rawRecords, sortKey, sortDir]);'.length;
if (queryStart !== -1 && recordsEnd !== -1) {
  const replacement = 
`  const listQuery = useDeliveryList({
    page: 1,
    pageSize: 500,
    role: scope === 'all' ? undefined : scope
  });
  const reportQuery = useDeliveryReport(user?.role === 'admin');

  const rawRecords = (listQuery.data?.records || []) as DeliveryDetailDto[];

  const uniqueStatuses = useMemo(() => {
    const set = new Set(rawRecords.map(o => o.status).filter(Boolean));
    return Array.from(set).sort();
  }, [rawRecords]);

  const uniqueOrders = useMemo(() => {
    const set = new Set(rawRecords.map(o => o.purchaseOrder?.title || o.purchaseOrder?.poNumber || '').filter(Boolean));
    return Array.from(set).sort();
  }, [rawRecords]);

  const uniqueCarriers = useMemo(() => {
    const set = new Set(rawRecords.map(o => o.carrierName || o.logisticsPartnerName || 'Carrier Not Assigned').filter(Boolean));
    return Array.from(set).sort();
  }, [rawRecords]);

  const processedOrders = useMemo(() => {
    let result = [...rawRecords];

    if (activeKpiFilter !== 'all') {
      if (activeKpiFilter === 'inMovement') {
        result = result.filter(r => ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'AT_HUB', 'PICKED_UP'].includes(r.status));
      } else if (activeKpiFilter === 'completed') {
        result = result.filter(r => ['DELIVERED', 'ACCEPTED', 'CLOSED', 'PAYMENT_RELEASED'].includes(r.status));
      } else if (activeKpiFilter === 'attention') {
        result = result.filter(r => ['DELAYED', 'DELIVERY_FAILED', 'DISPUTE_RAISED', 'RETURNED', 'CANCELLED'].includes(r.status));
      }
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(o => 
        String(o.trackingNumber || '').toLowerCase().includes(lower) ||
        String(o.purchaseOrder?.poNumber || '').toLowerCase().includes(lower) ||
        String(o.purchaseOrder?.title || '').toLowerCase().includes(lower) ||
        String(o.purchaseOrder?.seller?.name || '').toLowerCase().includes(lower) ||
        String(o.purchaseOrder?.buyer?.name || '').toLowerCase().includes(lower) ||
        String(o.carrierName || o.logisticsPartnerName || '').toLowerCase().includes(lower)
      );
    }

    if (statusFilter !== 'All Statuses') {
      result = result.filter(o => o.status === statusFilter);
    }

    if (orderFilter !== 'All Orders') {
      result = result.filter(o => (o.purchaseOrder?.title || o.purchaseOrder?.poNumber || '') === orderFilter);
    }

    if (carrierFilter !== 'All Carriers') {
      result = result.filter(o => (o.carrierName || o.logisticsPartnerName || 'Carrier Not Assigned') === carrierFilter);
    }

    if (amountFilter !== 'All Values') {
      result = result.filter(o => {
        const val = Number(o.purchaseOrder?.amount || 0);
        if (amountFilter === 'Below ₹10,000') return val < 10000;
        if (amountFilter === '₹10,000 – ₹50,000') return val >= 10000 && val <= 50000;
        if (amountFilter === '₹50,000 – ₹1,00,000') return val > 50000 && val <= 100000;
        if (amountFilter === 'Above ₹1,00,000') return val > 100000;
        return true;
      });
    }

    if (expectedDateFilter !== 'All Dates') {
      const now = new Date();
      result = result.filter(o => {
        if (!o.expectedDelivery) return expectedDateFilter === 'Custom Date Range' && (!customDate.start && !customDate.end);
        const dt = new Date(o.expectedDelivery);
        if (isNaN(dt.getTime())) return false;
        
        if (expectedDateFilter === 'Today') {
          return dt.toDateString() === now.toDateString();
        }
        if (expectedDateFilter === 'Tomorrow') {
          const tom = new Date(now);
          tom.setDate(now.getDate() + 1);
          return dt.toDateString() === tom.toDateString();
        }
        if (expectedDateFilter === 'Next 7 Days') {
          const sevenDays = new Date(now);
          sevenDays.setDate(now.getDate() + 7);
          return dt >= now && dt <= sevenDays;
        }
        if (expectedDateFilter === 'Next 30 Days') {
          const thirtyDays = new Date(now);
          thirtyDays.setDate(now.getDate() + 30);
          return dt >= now && dt <= thirtyDays;
        }
        if (expectedDateFilter === 'Overdue') {
          return dt < now && !['DELIVERED', 'ACCEPTED', 'CLOSED', 'CANCELLED'].includes(o.status);
        }
        if (expectedDateFilter === 'Custom Date Range') {
          if (!customDate.start && !customDate.end) return true;
          const start = customDate.start ? new Date(customDate.start) : new Date(0);
          start.setHours(0,0,0,0);
          const end = customDate.end ? new Date(customDate.end) : new Date(8640000000000000);
          end.setHours(23,59,59,999);
          return dt >= start && dt <= end;
        }
        return true;
      });
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    return result.sort((a, b) => {
      if (sortKey === 'updated_desc' || sortKey === 'updated_asc') {
        const dA = new Date(a.updatedAt || a.createdAt).getTime();
        const dB = new Date(b.updatedAt || b.createdAt).getTime();
        return (dA - dB) * (sortKey === 'updated_desc' ? -1 : 1);
      }
      
      switch (sortKey) {
        case 'expected_asc':
        case 'expected_desc': {
          const eA = a.expectedDelivery ? new Date(a.expectedDelivery).getTime() : 0;
          const eB = b.expectedDelivery ? new Date(b.expectedDelivery).getTime() : 0;
          return (eA - eB) * (sortKey === 'expected_asc' ? 1 : -1);
        }
        case 'value_high':
        case 'value_low': {
          const vA = Number(a.purchaseOrder?.amount || 0);
          const vB = Number(b.purchaseOrder?.amount || 0);
          return (vB - vA) * (sortKey === 'value_high' ? -1 : 1);
        }
        case 'tracking': {
          const tA = String(a.trackingNumber || \`DLV-\${a.id}\`).toLowerCase();
          const tB = String(b.trackingNumber || \`DLV-\${b.id}\`).toLowerCase();
          return tA.localeCompare(tB) * dir;
        }
        case 'order': {
          const oA = String(a.purchaseOrder?.title || a.purchaseOrder?.poNumber || '').toLowerCase();
          const oB = String(b.purchaseOrder?.title || b.purchaseOrder?.poNumber || '').toLowerCase();
          return oA.localeCompare(oB) * dir;
        }
        case 'parties': {
          const pA = String(a.purchaseOrder?.seller?.name || a.purchaseOrder?.buyer?.name || '').toLowerCase();
          const pB = String(b.purchaseOrder?.seller?.name || b.purchaseOrder?.buyer?.name || '').toLowerCase();
          return pA.localeCompare(pB) * dir;
        }
        case 'carrier': {
          const cA = String(a.carrierName || a.logisticsPartnerName || '').toLowerCase();
          const cB = String(b.carrierName || b.logisticsPartnerName || '').toLowerCase();
          return cA.localeCompare(cB) * dir;
        }
        case 'expected': {
          const eA = a.expectedDelivery ? new Date(a.expectedDelivery).getTime() : 0;
          const eB = b.expectedDelivery ? new Date(b.expectedDelivery).getTime() : 0;
          return (eA - eB) * dir;
        }
        case 'value': {
          const vA = Number(a.purchaseOrder?.amount || 0);
          const vB = Number(b.purchaseOrder?.amount || 0);
          return (vA - vB) * dir;
        }
        case 'status': {
          const sA = String(a.status || '').toLowerCase();
          const sB = String(b.status || '').toLowerCase();
          return sA.localeCompare(sB) * dir;
        }
        case 'id':
        default: {
          return (a.id - b.id) * dir;
        }
      }
    });
  }, [rawRecords, searchTerm, statusFilter, orderFilter, carrierFilter, amountFilter, expectedDateFilter, customDate, sortKey, sortDir, activeKpiFilter]);

  const { page, pageSize, total, pageItems: visibleRecords, setPage, setPageSize } = usePagination(processedOrders, 10);`;
  content = content.substring(0, queryStart) + replacement + content.substring(recordsEnd);
}

// 5. Update KPI Cards to use processedOrders instead of records
content = content.replace(/records\.filter/g, 'processedOrders.filter');

// 6. Update KPI card active props and onClick
content = content.replace(/active\{\=\[\'DISPATCHED\', \'IN_TRANSIT\', \'OUT_FOR_DELIVERY\', \'AT_HUB\', \'PICKED_UP\'\]\.includes\(statusFilter\)\}/g, "active={activeKpiFilter === 'inMovement'}");
content = content.replace(/onClick\{\(\) \=\> setStatusFilter\(prev \=\> prev \=\=\= \'DISPATCHED\' \? \'\' \: \'DISPATCHED\'\)\}/g, "onClick={() => setActiveKpiFilter(prev => prev === 'inMovement' ? 'all' : 'inMovement')}");

content = content.replace(/active\{\=\[\'DELIVERED\', \'ACCEPTED\', \'CLOSED\', \'PAYMENT_RELEASED\'\]\.includes\(statusFilter\)\}/g, "active={activeKpiFilter === 'completed'}");
content = content.replace(/onClick\{\(\) \=\> setStatusFilter\(prev \=\> prev \=\=\= \'DELIVERED\' \? \'\' \: \'DELIVERED\'\)\}/g, "onClick={() => setActiveKpiFilter(prev => prev === 'completed' ? 'all' : 'completed')}");

content = content.replace(/active\{\=\[\'DELAYED\', \'DELIVERY_FAILED\', \'DISPUTE_RAISED\', \'RETURNED\', \'CANCELLED\'\]\.includes\(statusFilter\)\}/g, "active={activeKpiFilter === 'attention'}");
content = content.replace(/onClick\{\(\) \=\> setStatusFilter\(prev \=\> prev \=\=\= \'DELAYED\' \? \'\' \: \'DELAYED\'\)\}/g, "onClick={() => setActiveKpiFilter(prev => prev === 'attention' ? 'all' : 'attention')}");

content = content.replace(/active\{\=\!statusFilter\}/g, "active={activeKpiFilter === 'all'}");
content = content.replace(/onClick\{\(\) \=\> setStatusFilter\(\'\'\)\}/g, "onClick={() => setActiveKpiFilter('all')}");

// 7. Remove startIndex and total calculations that were replaced
// We have `total` and `startIndex` (which doesn't exist anymore but is computed inside views).
// Wait, `startIndex` is passed to ListView and GridView. I should compute it.
content = content.replace("const startIndex = (page - 1) * pageSize;", "const startIndex = (page - 1) * pageSize;"); // Keep it since usePagination doesn't return startIndex

// 8. Replace Filter UI with the requested one
const filterStart = content.indexOf('{/* ── Search + Filter + View Toggle Toolbar ── */}');
const filterEnd = content.indexOf('{isInitialLoading ? (');
if (filterStart !== -1 && filterEnd !== -1) {
  const replacement = 
`      {/* ── Search + Filter + View Toggle Toolbar ── */}
      <div className="rounded-[18px] border border-slate-200/90 bg-white p-3 shadow-sm flex flex-wrap lg:flex-nowrap items-center gap-3">
        {/* Search */}
        <div className="flex-[1_1_auto] min-w-[240px] relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search tracking, PO, order, seller, buyer..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
          />
        </div>

        {/* Status */}
        <div className="flex-[0_0_auto] w-full sm:w-[130px]">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Statuses">Status: All</option>
            {uniqueStatuses.map(s => (
              <option key={s} value={s}>{DELIVERY_STATUS_LABELS[s as DeliveryStatus] || s}</option>
            ))}
          </select>
        </div>

        {/* Order */}
        <div className="flex-[0_0_auto] w-full sm:w-[150px]">
          <select
            value={orderFilter}
            onChange={e => setOrderFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Orders">Order: All</option>
            {uniqueOrders.map(o => (
              <option key={o} value={o}>{o.length > 25 ? o.substring(0, 25) + '...' : o}</option>
            ))}
          </select>
        </div>

        {/* Carrier */}
        <div className="flex-[0_0_auto] w-full sm:w-[140px]">
          <select
            value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Carriers">Carrier: All</option>
            {uniqueCarriers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Value */}
        <div className="flex-[0_0_auto] w-full sm:w-[130px]">
          <select
            value={amountFilter}
            onChange={e => setAmountFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Values">Value: All</option>
            <option value="Below ₹10,000">Below ₹10,000</option>
            <option value="₹10,000 – ₹50,000">₹10,000 – ₹50,000</option>
            <option value="₹50,000 – ₹1,00,000">₹50,000 – ₹1,00,000</option>
            <option value="Above ₹1,00,000">Above ₹1,00,000</option>
          </select>
        </div>

        {/* Expected Delivery */}
        <div className="flex-[0_0_auto] w-full sm:w-[140px] flex items-center gap-[12px]">
          <select
            value={expectedDateFilter}
            onChange={e => setExpectedDateFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Dates">Expected: All</option>
            <option value="Today">Today</option>
            <option value="Tomorrow">Tomorrow</option>
            <option value="Next 7 Days">Next 7 Days</option>
            <option value="Next 30 Days">Next 30 Days</option>
            <option value="Overdue">Overdue</option>
            <option value="Custom Date Range">Custom Date Range</option>
          </select>
        </div>

        {expectedDateFilter === 'Custom Date Range' && (
          <div 
            className="flex-[0_0_auto] grid items-center gap-1 w-full sm:w-auto h-10"
            style={{ gridTemplateColumns: 'minmax(0, 1fr) 20px minmax(0, 1fr)' }}
          >
            <input 
              type="date" 
              value={customDate.start} 
              onChange={e => setCustomDate({ ...customDate, start: e.target.value })} 
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-xs font-bold text-slate-700 outline-none" 
              title="Start Date" 
            />
            <span className="text-slate-400 font-bold text-center">-</span>
            <input 
              type="date" 
              value={customDate.end} 
              onChange={e => setCustomDate({ ...customDate, end: e.target.value })} 
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-xs font-bold text-slate-700 outline-none" 
              title="End Date" 
            />
          </div>
        )}

        {/* Sort */}
        <div className="flex-[0_0_auto] w-full sm:w-[130px]">
          <select
            value={sortKey}
            onChange={e => {
              setSortKey(e.target.value);
              setSortDir(e.target.value.includes('_asc') ? 'asc' : 'desc');
            }}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="updated_desc">Latest Updated</option>
            <option value="updated_asc">Oldest Updated</option>
            <option value="expected_asc">Expected - Soonest</option>
            <option value="expected_desc">Expected - Latest</option>
            <option value="value_high">Highest Value</option>
            <option value="value_low">Lowest Value</option>
          </select>
        </div>

        {/* Right Actions */}
        <div className="flex-[0_0_auto] flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          {(searchTerm || statusFilter !== 'All Statuses' || orderFilter !== 'All Orders' || carrierFilter !== 'All Carriers' || amountFilter !== 'All Values' || expectedDateFilter !== 'All Dates' || sortKey !== 'updated_desc') && (
            <Button 
              variant="ghost" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All Statuses');
                setOrderFilter('All Orders');
                setCarrierFilter('All Carriers');
                setAmountFilter('All Values');
                setExpectedDateFilter('All Dates');
                setCustomDate({ start: '', end: '' });
                setSortKey('updated_desc');
                setSortDir('desc');
                setActiveKpiFilter('all');
              }}
              className="h-9 px-2 text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 shrink-0"
            >
              Clear Filters
            </Button>
          )}
          <div className="shrink-0">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      `;
  content = content.substring(0, filterStart) + replacement + content.substring(filterEnd);
}

// 9. Update lists to use visibleRecords
content = content.replace(/records=\{records\}/g, "records={visibleRecords}");
content = content.replace(/records\.length === 0/g, "processedOrders.length === 0");
content = content.replace(/debouncedSearch \|\| statusFilter/g, "searchTerm || statusFilter !== 'All Statuses'");


fs.writeFileSync('frontend/src/features/delivery/pages/DeliveryListPage.tsx', content);
console.log('Done rewriting DeliveryListPage.tsx');
