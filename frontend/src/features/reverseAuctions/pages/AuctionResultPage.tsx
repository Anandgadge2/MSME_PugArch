import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { DataTable, ColumnDef } from '../../../components/ui/data-table';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency } from '../../shared/format';
import { reverseAuctionApi } from '../api';

export default function AuctionResultPage({ id }: { id: number }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['reverse-auction-result', id], queryFn: () => reverseAuctionApi.result(id), staleTime: 10_000 });
  const award = useMutation({
    mutationFn: (participantId?: number) => reverseAuctionApi.recommendAward(id, participantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reverse-auction-result', id] })
  });

  if (query.isLoading) return <LoadingState label="Loading auction result..." />;
  if (query.error) return <InlineError message={(query.error as Error).message} onRetry={() => query.refetch()} />;

  const ranking = query.data?.ranking || [];

  const columns: ColumnDef<any>[] = [
    {
      key: 'rank',
      header: 'Rank',
      width: 'w-24',
      cell: (row, index) => (
        <span className="text-base font-black text-slate-950">
          L{row.currentRank || index + 1}
        </span>
      ),
    },
    {
      key: 'seller',
      header: 'Seller Org',
      width: 'w-64',
      cell: (row) => (
        <span className="font-bold text-slate-800">
          {row.sellerOrgName || `Organization #${row.sellerOrgId}`}
        </span>
      ),
    },
    {
      key: 'lastBid',
      header: 'Last Bid',
      width: 'w-36',
      cell: (row) => (
        <span className="font-black text-slate-950">
          {row.lastBidAmount ? formatCurrency(row.lastBidAmount) : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-32',
      cell: (row) => (
        <span className="text-xs font-bold uppercase text-slate-500">{row.status}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: 'w-36',
      align: 'right',
      cellClassName: 'text-right',
      cell: (row) => (
        <Button size="sm" onClick={() => award.mutate(row.id)} disabled={award.isPending}>
          <Award className="mr-1 h-3.5 w-3.5" />Recommend
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">{query.data?.auction?.title || `Auction #${id}`}</h1>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {query.data?.auction?.procurementMethod || 'REVERSE_AUCTION'} · Rank visibility: {query.data?.auction?.rankVisibility || 'SHOW_RANK_ONLY'} · Award basis: final L1 auction rank
          </p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>
      {ranking.length === 0 ? (
        <EmptyState title="No ranked bids yet" />
      ) : (
        <DataTable<any>
          data={ranking}
          columns={columns}
          keyExtractor={(row) => row.id}
          minWidth="min-w-[720px]"
        />
      )}
    </div>
  );
}
