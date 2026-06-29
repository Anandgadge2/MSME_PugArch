import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Gavel, Pause, Play, RefreshCw, Send, Square, UserPlus, Loader2, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency, formatDate } from '../../shared/format';
import { reverseAuctionApi } from '../api';
import { marketplaceApi, type MarketplaceSeller } from '../../marketplace/api';
import { cn } from '../../../lib/utils';

export default function ReverseAuctionDetailPage({ id }: { id: number }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<MarketplaceSeller | null>(null);
  const auction = useQuery({ queryKey: ['reverse-auction', id], queryFn: () => reverseAuctionApi.get(id), refetchInterval: 10_000 });
  const summary = useQuery({ queryKey: ['reverse-auction-summary', id], queryFn: () => reverseAuctionApi.liveSummary(id), refetchInterval: 5_000 });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['reverse-auction', id] });
    qc.invalidateQueries({ queryKey: ['reverse-auction-summary', id] });
  };
  const transition = useMutation({ mutationFn: (action: 'schedule' | 'start' | 'pause' | 'resume' | 'close') => reverseAuctionApi.transition(id, action), onSuccess: invalidate });
  const invite = useMutation({
    mutationFn: (args: { sellerOrgId: number; sellerUserId?: number }) => reverseAuctionApi.inviteSellers(id, [args]),
    onSuccess: () => { setMessage('Seller invited'); invalidate(); },
    onError: err => setMessage((err as Error).message)
  });
  const bid = useMutation({
    mutationFn: (amount: number) => reverseAuctionApi.placeBid(id, amount),
    onSuccess: () => { setMessage('Bid submitted'); invalidate(); },
    onError: err => setMessage((err as Error).message)
  });

  if (auction.isLoading) return <LoadingState label="Loading reverse auction..." />;
  if (auction.error) return <InlineError message={(auction.error as Error).message} onRetry={() => auction.refetch()} />;
  if (!auction.data) return <EmptyState title="Auction not found" />;

  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSeller) return;
    invite.mutate({
      sellerOrgId: selectedSeller.id,
      sellerUserId: selectedSeller.sellerUserId || undefined
    });
    setSelectedSeller(null);
  };
  const submitBid = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    bid.mutate(Number(form.get('amount')));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">{auction.data.auctionCode || `Auction #${id}`}</p>
          <h1 className="text-2xl font-black text-slate-950">{auction.data.title || 'Reverse auction'}</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(auction.data.startTime)} - {formatDate(auction.data.endTime)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => auction.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button variant="outline" onClick={() => transition.mutate('schedule')}><Gavel className="mr-2 h-4 w-4" />Schedule</Button>
          <Button onClick={() => transition.mutate('start')}><Play className="mr-2 h-4 w-4" />Start</Button>
          <Button variant="secondary" onClick={() => transition.mutate('pause')}><Pause className="mr-2 h-4 w-4" />Pause</Button>
          <Button variant="danger" onClick={() => transition.mutate('close')}><Square className="mr-2 h-4 w-4" />Close</Button>
        </div>
      </div>
      {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-[#12335f]">{message}</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Status" value={String(auction.data.status).replace(/_/g, ' ')} />
              <Metric label="Starting price" value={formatCurrency(auction.data.startPrice)} />
              <Metric label="Current lowest" value={auction.data.currentLowestAmount ? formatCurrency(auction.data.currentLowestAmount) : '-'} />
              <Metric label="Minimum next" value={summary.data?.minimumNextBid ? formatCurrency(summary.data.minimumNextBid) : '-'} />
            </div>
            <p className="text-sm font-semibold leading-6 text-slate-600">{auction.data.description || 'No description provided.'}</p>
            <div className="flex gap-2">
              <Link href={`/reverse-auctions/${id}/live`}><Button size="sm">Open Live Screen</Button></Link>
              <Link href={`/reverse-auctions/${id}/results`}><Button size="sm" variant="outline">View Results</Button></Link>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <form onSubmit={submitInvite} className="space-y-3">
                <p className="text-sm font-black text-slate-950">Invite seller organization</p>
                <VendorSearchableDropdown
                  value={selectedSeller?.id || ''}
                  onChange={(seller) => setSelectedSeller(seller)}
                />
                <Button disabled={invite.isPending || !selectedSeller} className="w-full"><UserPlus className="mr-2 h-4 w-4" />Invite</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <form onSubmit={submitBid} className="space-y-3">
                <p className="text-sm font-black text-slate-950">Seller bid</p>
                <input name="amount" type="number" min="1" step="0.01" required placeholder="Bid amount" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none" />
                <Button disabled={bid.isPending} className="w-full"><Send className="mr-2 h-4 w-4" />Submit Bid</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

interface VendorSearchableDropdownProps {
  value: string | number;
  onChange: (seller: MarketplaceSeller | null) => void;
  placeholder?: string;
  className?: string;
}

function VendorSearchableDropdown({ value, onChange, placeholder = 'Search vendor name or organization...', className }: VendorSearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sellers, setSellers] = useState<MarketplaceSeller[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<MarketplaceSeller | null>(null);

  // Fetch initial seller if value exists
  useEffect(() => {
    if (value) {
      setLoading(true);
      marketplaceApi.getSellers({ pageSize: 50 })
        .then(res => {
          const found = res?.sellers?.find((s: any) => s.id === Number(value));
          if (found) {
            setSelectedSeller(found);
            setSearch(found.organizationName);
          }
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setSelectedSeller(null);
      setSearch('');
    }
  }, [value]);

  // Debounce search query
  useEffect(() => {
    if (!open) return;
    const delayDebounce = setTimeout(() => {
      setLoading(true);
      const params: Record<string, string | number> = { pageSize: 20 };
      if (search) params.q = search;
      marketplaceApi.getSellers(params)
        .then(res => {
          setSellers(res?.sellers || []);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [search, open]);

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        <input
          type="text"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[#12335f]" />}
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedSeller(null);
                onChange(null);
                setSellers([]);
              }}
              className="hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg z-20">
            {loading && sellers.length === 0 ? (
              <div className="p-3 text-center text-xs font-semibold text-slate-500">Loading sellers...</div>
            ) : sellers.length === 0 ? (
              <div className="p-3 text-center text-xs font-semibold text-slate-500">No sellers found</div>
            ) : (
              sellers.map((seller) => {
                const isValid = seller.sellerUserId !== null && seller.sellerUserId !== undefined;
                const isSelected = selectedSeller?.id === seller.id;
                return (
                  <button
                    key={seller.id}
                    type="button"
                    disabled={!isValid}
                    onClick={() => {
                      setSelectedSeller(seller);
                      setSearch(seller.organizationName);
                      onChange(seller);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-xs transition",
                      !isValid ? "opacity-50 cursor-not-allowed bg-slate-50/50" : "hover:bg-slate-50",
                      isSelected && "bg-blue-50 text-[#12335f]"
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{seller.organizationName}</span>
                      {seller.verificationStatus === 'VERIFIED' && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] uppercase font-bold border border-emerald-200 text-emerald-700">Verified</span>
                      )}
                    </div>
                    <div className="mt-1 flex w-full items-center justify-between text-[10px] text-slate-500 font-semibold">
                      <span>
                        {seller.organizationType} · {[seller.city, seller.state].filter(Boolean).join(', ')}
                      </span>
                      {!isValid && (
                        <span className="text-red-500 font-bold">No active user account</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

