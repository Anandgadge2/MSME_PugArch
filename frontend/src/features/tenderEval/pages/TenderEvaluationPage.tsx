/**
 * TenderEvaluationPage — full two-bid evaluation workflow.
 *
 * Tabs:
 *   1. Criteria — define scoring criteria for the tender
 *   2. Technical — score each bid against criteria
 *   3. Financial — open & evaluate financial bids of qualified vendors
 *   4. Ranking — auto L1/L2/L3 sorted by evaluated amount
 *   5. Comparative Statement — generate & view CS
 *
 * Route: /buyer/tenders/:id/evaluate
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Award, BarChart3, ClipboardCheck, FileText, Lock, Plus, Send, Settings2, Trophy, Unlock, X } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { usePermissions } from '../../../hooks/useOrgRole';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { type SortDirection } from '../../shared/SortableHeader';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { formatCurrency, formatDateTime } from '../../shared/format';
import { runWithToast } from '../../../lib/toast';
import { getApi } from '../../shared/apiClient';
import {
    useComparativeStatement,
    useCreateCriterion,
    useCriteria,
    useFinancialBids,
    useGenerateComparative,
    useOpenFinancialBids,
    useRanking,
    useSubmitFinancialEvaluation,
    useSubmitTechnicalScores,
    useTechnicalEvaluation
} from '../hooks';

type Tab = 'criteria' | 'technical' | 'financial' | 'ranking' | 'comparative';

interface Props {
    tenderId: number;
}

export default function TenderEvaluationPage({ tenderId }: Props) {
    const router = useRouter();
    const { hasPermission } = usePermissions();
    const [tab, setTab] = useState<Tab>('criteria');
    const [tender, setTender] = useState<any>(null);

    useEffect(() => {
        void (async () => {
            try {
                const data = await getApi<any>(`/api/tenders/${tenderId}`);
                setTender(data?.data || data);
            } catch {
                toast.error('Failed to load tender');
            }
        })();
    }, [tenderId]);

    const tabs: Array<{ id: Tab; label: string; icon: any; allowed: boolean }> = [
        { id: 'criteria', label: 'Criteria', icon: Settings2, allowed: true },
        { id: 'technical', label: 'Technical', icon: ClipboardCheck, allowed: hasPermission('bid.technical.evaluate') },
        { id: 'financial', label: 'Financial', icon: BarChart3, allowed: hasPermission('bid.financial.evaluate') },
        { id: 'ranking', label: 'L1 / L2 / L3', icon: Trophy, allowed: true },
        { id: 'comparative', label: 'Comparative Statement', icon: Award, allowed: true }
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                    <button onClick={() => router.push('/buyer/tenders')} className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-[#12335f] hover:underline">
                        <ArrowLeft className="mr-1 h-3 w-3" /> Back to Tenders
                    </button>
                    <h1 className="mt-1 text-2xl font-black text-slate-950 text-wrap-anywhere">Tender Evaluation</h1>
                    {tender && (
                        <p className="text-xs font-semibold text-slate-500 text-wrap-anywhere">
                            {tender.tenderId} · {tender.title} · Budget {formatCurrency(tender.budget)}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
                {tabs.filter(t => t.allowed).map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 transition shrink-0 ${tab === t.id ? 'border-[#12335f] text-[#12335f]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <t.icon className="mr-1.5 h-3.5 w-3.5" />
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'criteria' && <CriteriaTab tenderId={tenderId} />}
            {tab === 'technical' && <TechnicalTab tenderId={tenderId} />}
            {tab === 'financial' && <FinancialTab tenderId={tenderId} />}
            {tab === 'ranking' && <RankingTab tenderId={tenderId} />}
            {tab === 'comparative' && <ComparativeTab tenderId={tenderId} />}
        </div>
    );
}

// ─── Criteria Tab ────────────────────────────────────────────────────────────

function CriteriaTab({ tenderId }: { tenderId: number }) {
    const { hasPermission } = usePermissions();
    const { data, isLoading, error } = useCriteria(tenderId);
    const createMut = useCreateCriterion(tenderId);
    const [showAdd, setShowAdd] = useState(false);

    const canEdit = hasPermission('tender.update') || hasPermission('bid.technical.evaluate');

    type CriteriaSortKey = 'name' | 'maxScore' | 'weightage' | 'isMandatory';
    const [sortKey, setSortKey] = useState<CriteriaSortKey>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const toggleSort = (key: CriteriaSortKey) => {
        setSortDirection(prev => sortKey === key && prev === 'asc' ? 'desc' : 'asc');
        setSortKey(key);
    };

    const sortedCriteria = (data || []).slice().sort((a, b) => {
        let valA: any = a[sortKey];
        let valB: any = b[sortKey];
        if (sortKey === 'maxScore' || sortKey === 'weightage') {
            return sortDirection === 'asc' ? Number(valA || 0) - Number(valB || 0) : Number(valB || 0) - Number(valA || 0);
        }
        if (sortKey === 'isMandatory') {
            return sortDirection === 'asc' ? (a.isMandatory ? 1 : 0) - (b.isMandatory ? 1 : 0) : (b.isMandatory ? 1 : 0) - (a.isMandatory ? 1 : 0);
        }
        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        const res = strA.localeCompare(strB);
        return sortDirection === 'asc' ? res : -res;
    });

    const criteriaColumns: ColumnDef<any>[] = [
        {
            key: 'name',
            header: 'Name',
            sortable: true,
            sortKey: 'name',
            cell: (c: any) => (
                <div>
                    <p className="text-xs font-black text-slate-900 text-wrap-anywhere">{c.name}</p>
                    {c.description && <p className="text-[10px] text-slate-500 text-wrap-anywhere">{c.description}</p>}
                </div>
            )
        },
        {
            key: 'maxScore',
            header: 'Max Score',
            sortable: true,
            sortKey: 'maxScore',
            align: 'right',
            width: 'w-32',
            cellClassName: 'font-mono text-xs font-bold',
            cell: (c: any) => Number(c.maxScore)
        },
        {
            key: 'weightage',
            header: 'Weightage %',
            sortable: true,
            sortKey: 'weightage',
            align: 'right',
            width: 'w-32',
            cellClassName: 'font-mono text-xs',
            cell: (c: any) => (c.weightage ? `${Number(c.weightage)}%` : '—')
        },
        {
            key: 'isMandatory',
            header: 'Mandatory',
            sortable: true,
            sortKey: 'isMandatory',
            align: 'center',
            width: 'w-32',
            cell: (c: any) => c.isMandatory ? (
                <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700">Yes</span>
            ) : <span className="text-[10px] text-slate-400">—</span>
        }
    ];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">
                    Define the criteria used to score technical bids. Scores are summed; ≥60% qualifies for financial evaluation.
                </p>
                {canEdit && (
                    <Button onClick={() => setShowAdd(true)} className="bg-[#12335f] text-white">
                        <Plus className="mr-2 h-4 w-4" /> Add Criterion
                    </Button>
                )}
            </div>

            {error ? (
                <InlineError message={(error as Error).message} />
            ) : (
                <DataTable
                    data={sortedCriteria}
                    columns={criteriaColumns}
                    isLoading={isLoading}
                    skeletonRows={4}
                    showSrNo={true}
                    srNoHeader="#"
                    srNoWidth="w-12"
                    minWidth="min-w-[500px]"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={(field) => toggleSort(field as CriteriaSortKey)}
                    keyExtractor={(c: any) => c.id}
                    emptyTitle="No criteria defined"
                    emptyDescription="Add the first scoring criterion to begin technical evaluation."
                />
            )}

            {showAdd && (
                <AddCriterionModal
                    onClose={() => setShowAdd(false)}
                    onSubmit={async (data) => {
                        await runWithToast(() => createMut.mutateAsync(data), {
                            loading: 'Adding...', success: 'Criterion added', error: 'Failed to add'
                        });
                        setShowAdd(false);
                    }}
                    pending={createMut.isPending}
                />
            )}
        </div>
    );
}

function AddCriterionModal({ onClose, onSubmit, pending }: { onClose: () => void; onSubmit: (d: any) => Promise<void>; pending: boolean }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [maxScore, setMaxScore] = useState(100);
    const [weightage, setWeightage] = useState<number | ''>('');
    const [isMandatory, setIsMandatory] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] px-5 py-4 text-white">
                    <h3 className="text-sm font-black uppercase tracking-widest">Add Scoring Criterion</h3>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <div className="p-5 space-y-3">
                    <Field label="Name *">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Technical specification compliance"
                            className="h-[40px] sm:h-9 w-full rounded border border-slate-200 px-3 text-[11px] sm:text-xs font-semibold" />
                    </Field>
                    <Field label="Description">
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                            className="w-full rounded border border-slate-200 px-3 py-2 text-[11px] sm:text-xs font-semibold" />
                    </Field>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <Field label="Max Score *">
                            <input type="number" value={maxScore} onChange={e => setMaxScore(Number(e.target.value))} min={1}
                                className="h-[40px] sm:h-9 w-full rounded border border-slate-200 px-3 text-[11px] sm:text-xs font-semibold" />
                        </Field>
                        <Field label="Weightage %">
                            <input type="number" value={weightage} onChange={e => setWeightage(e.target.value === '' ? '' : Number(e.target.value))} min={0} max={100}
                                className="h-[40px] sm:h-9 w-full rounded border border-slate-200 px-3 text-[11px] sm:text-xs font-semibold" />
                        </Field>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold">
                        <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} />
                        Mandatory criterion
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button
                            onClick={() => onSubmit({ name, description, maxScore, weightage: weightage === '' ? undefined : weightage, isMandatory })}
                            disabled={pending || !name.trim() || maxScore <= 0}
                            className="bg-[#12335f] text-white"
                        >
                            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Add
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-0.5 sm:space-y-1">
            <label className="text-[9px] sm:text-[10px] font-bold sm:font-black uppercase tracking-wide sm:tracking-wider text-slate-400">{label}</label>
            {children}
        </div>
    );
}

// ─── Technical Tab ───────────────────────────────────────────────────────────

function TechnicalTab({ tenderId }: { tenderId: number }) {
    const { data, isLoading, error, refetch } = useTechnicalEvaluation(tenderId);
    const submitMut = useSubmitTechnicalScores(tenderId);
    const [scoring, setScoring] = useState<{ bidId: number; scores: Record<number, number>; remarks: Record<number, string> } | null>(null);

    type TechSortKey = 'bidder' | 'totalScore' | 'percent' | 'status';
    const [sortKey, setSortKey] = useState<TechSortKey>('percent');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    if (isLoading) return <LoadingState label="Loading technical evaluation..." />;
    if (error) return <InlineError message={(error as Error).message} onRetry={() => refetch()} />;
    if (!data) return null;

    const { criteria, bidScores } = data;

    if (criteria.length === 0) {
        return (
            <Card><CardContent className="py-12">
                <EmptyState title="Define criteria first" description="Switch to the Criteria tab and add scoring criteria before evaluating bids." />
            </CardContent></Card>
        );
    }

    if (bidScores.length === 0) {
        return (
            <Card><CardContent className="py-12">
                <EmptyState title="No bids submitted yet" description="Bids will appear here after the tender deadline." />
            </CardContent></Card>
        );
    }

    const toggleSort = (key: TechSortKey) => {
        setSortDirection(prev => sortKey === key && prev === 'asc' ? 'desc' : 'asc');
        setSortKey(key);
    };

    const sortedBidScores = (bidScores || []).slice().sort((a, b) => {
        if (sortKey === 'bidder') {
            const nameA = a.bid.seller?.name || `Seller #${a.bid.sellerId}`;
            const nameB = b.bid.seller?.name || `Seller #${b.bid.sellerId}`;
            const res = nameA.localeCompare(nameB);
            return sortDirection === 'asc' ? res : -res;
        }
        if (sortKey === 'totalScore') {
            return sortDirection === 'asc' ? a.totalScore - b.totalScore : b.totalScore - a.totalScore;
        }
        if (sortKey === 'percent') {
            return sortDirection === 'asc' ? a.percent - b.percent : b.percent - a.percent;
        }
        if (sortKey === 'status') {
            const stA = !a.isFullyEvaluated ? 0 : a.qualified ? 2 : 1;
            const stB = !b.isFullyEvaluated ? 0 : b.qualified ? 2 : 1;
            return sortDirection === 'asc' ? stA - stB : stB - stA;
        }
        return 0;
    });

    const technicalColumns: ColumnDef<any>[] = [
        {
            key: 'bidder',
            header: 'Bidder',
            sortable: true,
            sortKey: 'bidder',
            cell: (b: any) => (
                <div>
                    <p className="text-xs font-black text-slate-900 text-wrap-anywhere">{b.bid.seller?.name || `Seller #${b.bid.sellerId}`}</p>
                    <p className="text-[10px] text-slate-500">{b.bid.seller?.email}</p>
                </div>
            )
        },
        {
            key: 'totalScore',
            header: 'Score',
            sortable: true,
            sortKey: 'totalScore',
            align: 'right',
            width: 'w-32',
            cellClassName: 'font-mono text-xs font-bold',
            cell: (b: any) => `${b.totalScore} / ${b.maxScore}`
        },
        {
            key: 'percent',
            header: '% Pass',
            sortable: true,
            sortKey: 'percent',
            align: 'right',
            width: 'w-24',
            cellClassName: 'font-mono text-xs font-black',
            cell: (b: any) => `${b.percent}%`
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            sortKey: 'status',
            align: 'center',
            width: 'w-32',
            cell: (b: any) => !b.isFullyEvaluated ? (
                <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">Pending</span>
            ) : b.qualified ? (
                <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">Qualified</span>
            ) : (
                <span className="inline-flex rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">Disqualified</span>
            )
        },
        {
            key: 'action',
            header: 'Action',
            align: 'right',
            width: 'w-32',
            cell: (b: any) => (
                <Button variant="outline" size="sm"
                    onClick={() => {
                        const scores: Record<number, number> = {};
                        const remarks: Record<number, string> = {};
                        b.results.forEach((r: any) => {
                            scores[r.criteriaId] = Number(r.score);
                            if (r.remarks) remarks[r.criteriaId] = r.remarks;
                        });
                        setScoring({ bidId: b.bid.id, scores, remarks });
                    }}
                >
                    Score
                </Button>
            )
        }
    ];

    return (
        <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600">
                Score each bid against the criteria. Bids scoring ≥60% qualify for financial evaluation.
            </p>

            <DataTable
                data={sortedBidScores}
                columns={technicalColumns}
                showSrNo={false}
                minWidth="min-w-[600px]"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={(field) => toggleSort(field as TechSortKey)}
                keyExtractor={(b: any) => b.bid.id}
                emptyTitle="No bids found"
                emptyDescription="No bids available for technical scoring."
            />

            {scoring && (
                <ScoringModal
                    bidId={scoring.bidId}
                    criteria={criteria}
                    initialScores={scoring.scores}
                    initialRemarks={scoring.remarks}
                    onClose={() => setScoring(null)}
                    onSubmit={async (scores) => {
                        await runWithToast(
                            () => submitMut.mutateAsync({ bidId: scoring.bidId, scores }),
                            { loading: 'Saving scores...', success: 'Scores saved', error: 'Save failed' }
                        );
                        setScoring(null);
                    }}
                    pending={submitMut.isPending}
                />
            )}
        </div>
    );
}

function ScoringModal({ bidId, criteria, initialScores, initialRemarks, onClose, onSubmit, pending }: {
    bidId: number;
    criteria: Array<{ id: number; name: string; description?: string | null; maxScore: string | number }>;
    initialScores: Record<number, number>;
    initialRemarks: Record<number, string>;
    onClose: () => void;
    onSubmit: (scores: Array<{ criteriaId: number; score: number; remarks?: string }>) => Promise<void>;
    pending: boolean;
}) {
    const [scores, setScores] = useState<Record<number, number>>(initialScores);
    const [remarks, setRemarks] = useState<Record<number, string>>(initialRemarks);

    const total = criteria.reduce((s, c) => s + (scores[c.id] || 0), 0);
    const max = criteria.reduce((s, c) => s + Number(c.maxScore), 0);
    const percent = max > 0 ? Math.round((total / max) * 10000) / 100 : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] px-5 py-4 text-white">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Score Bid #{bidId}</h3>
                        <p className="mt-0.5 text-[10px] text-white/70">Total: {total} / {max} ({percent}%) {percent >= 60 ? '✓ Qualifying' : '✗ Below 60%'}</p>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {criteria.map(c => (
                        <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-slate-900 text-wrap-anywhere">{c.name}</p>
                                    {c.description && <p className="text-[10px] text-slate-500 text-wrap-anywhere">{c.description}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        value={scores[c.id] ?? ''}
                                        onChange={e => setScores(prev => ({ ...prev, [c.id]: Number(e.target.value) }))}
                                        min={0}
                                        max={Number(c.maxScore)}
                                        className="h-8 w-20 rounded border border-slate-200 px-2 text-xs font-mono font-bold text-right"
                                    />
                                    <span className="text-xs font-bold text-slate-500">/ {Number(c.maxScore)}</span>
                                </div>
                            </div>
                            <input
                                type="text"
                                value={remarks[c.id] || ''}
                                onChange={e => setRemarks(prev => ({ ...prev, [c.id]: e.target.value }))}
                                placeholder="Remarks (optional)"
                                className="mt-2 h-8 w-full rounded border border-slate-200 px-2 text-xs font-semibold"
                            />
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={() => onSubmit(criteria.map(c => ({
                            criteriaId: c.id,
                            score: scores[c.id] || 0,
                            remarks: remarks[c.id] || undefined
                        })))}
                        disabled={pending}
                        className="bg-[#12335f] text-white"
                    >
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Save Scores
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Financial Tab ───────────────────────────────────────────────────────────

function FinancialTab({ tenderId }: { tenderId: number }) {
    const { hasPermission } = usePermissions();
    const { data, isLoading, error, refetch } = useFinancialBids(tenderId);
    const openMut = useOpenFinancialBids(tenderId);
    const evalMut = useSubmitFinancialEvaluation(tenderId);
    const canOpen = hasPermission('bid.financial.evaluate');

    if (isLoading) return <LoadingState label="Loading financial bids..." />;
    if (error) return <InlineError message={(error as Error).message} onRetry={() => refetch()} />;

    const financialColumns: ColumnDef<any>[] = [
        {
            key: 'bidder',
            header: 'Bidder',
            cell: (b: any) => (
                <div>
                    <p className="text-xs font-black text-slate-900 text-wrap-anywhere">{b.bid.seller?.name}</p>
                    <p className="text-[10px] text-slate-500">{b.bid.seller?.email}</p>
                </div>
            )
        },
        {
            key: 'technicalPercent',
            header: 'Tech %',
            align: 'right',
            width: 'w-28',
            cellClassName: 'font-mono text-xs',
            cell: (b: any) => `${b.technicalPercent}%`
        },
        {
            key: 'quotedAmount',
            header: 'Quoted',
            align: 'right',
            width: 'w-36',
            cellClassName: 'font-mono text-xs font-bold',
            cell: (b: any) => formatCurrency(b.quotedAmount)
        },
        {
            key: 'evaluatedAmount',
            header: 'Evaluated',
            align: 'right',
            width: 'w-36',
            cellClassName: 'font-mono text-xs font-black',
            cell: (b: any) => formatCurrency(b.evaluatedAmount)
        },
        {
            key: 'action',
            header: 'Action',
            align: 'right',
            width: 'w-36',
            cell: (b: any) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                        const input = window.prompt('Enter evaluated amount (for landed cost / tax adjustments)', String(b.evaluatedAmount));
                        if (input === null) return;
                        const num = Number(input);
                        if (!Number.isFinite(num) || num < 0) { toast.error('Invalid amount'); return; }
                        await runWithToast(
                            () => evalMut.mutateAsync({ bidId: b.bid.id, data: { evaluatedAmount: num } }),
                            { loading: 'Saving...', success: 'Saved', error: 'Failed' }
                        );
                    }}
                >
                    Adjust
                </Button>
            )
        }
    ];

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-blue-800">Two-Bid System</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                        Only technically qualified bids (≥60% score) appear here. Open the financial bids before evaluating.
                    </p>
                </div>
                {canOpen && (
                    <Button
                        onClick={() => runWithToast(() => openMut.mutateAsync(), {
                            loading: 'Opening...', success: 'Financial bids opened', error: 'Failed'
                        })}
                        disabled={openMut.isPending}
                        className="bg-blue-700 text-white hover:bg-blue-800 shrink-0"
                    >
                        {openMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                        Open Financial Bids
                    </Button>
                )}
            </div>

            <DataTable
                data={data || []}
                columns={financialColumns}
                showSrNo={false}
                minWidth="min-w-[600px]"
                keyExtractor={(b: any) => b.bid.id}
                emptyTitle="No qualifying bids"
                emptyDescription="Bids must score ≥60% in technical evaluation to appear here."
            />
        </div>
    );
}

// ─── Ranking Tab ─────────────────────────────────────────────────────────────

function RankingTab({ tenderId }: { tenderId: number }) {
    const { data, isLoading, error, refetch } = useRanking(tenderId);

    const rankingColumns: ColumnDef<any>[] = [
        {
            key: 'rank',
            header: 'Rank',
            width: 'w-24',
            cell: (b: any) => (
                <span className={`inline-flex h-8 w-12 items-center justify-center rounded-md font-black ${
                    b.rank === 1 ? 'bg-emerald-600 text-white' :
                    b.rank === 2 ? 'bg-blue-100 text-blue-800' :
                    b.rank === 3 ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-600'
                }`}>
                    {b.label}
                </span>
            )
        },
        {
            key: 'bidder',
            header: 'Bidder',
            cell: (b: any) => (
                <div>
                    <p className="text-xs font-black text-slate-900 text-wrap-anywhere">{b.bid.seller?.name}</p>
                    <p className="text-[10px] text-slate-500">{b.bid.seller?.email}</p>
                </div>
            )
        },
        {
            key: 'technicalPercent',
            header: 'Tech %',
            align: 'right',
            width: 'w-28',
            cellClassName: 'font-mono text-xs',
            cell: (b: any) => `${b.technicalPercent}%`
        },
        {
            key: 'evaluatedAmount',
            header: 'Final Amount',
            align: 'right',
            width: 'w-36',
            cellClassName: 'font-mono text-base font-black',
            cell: (b: any) => formatCurrency(b.evaluatedAmount)
        }
    ];

    if (error) return <InlineError message={(error as Error).message} onRetry={() => refetch()} />;

    return (
        <DataTable
            data={data || []}
            columns={rankingColumns}
            isLoading={isLoading}
            skeletonRows={3}
            showSrNo={false}
            minWidth="min-w-[600px]"
            rowClassName={(b: any) => b.rank === 1 ? 'bg-emerald-50/30' : ''}
            keyExtractor={(b: any) => b.bid.id}
            emptyTitle="No qualified bids"
            emptyDescription="Complete technical and financial evaluation to see L1/L2/L3 ranking."
        />
    );
}

// ─── Comparative Statement Tab ───────────────────────────────────────────────

function ComparativeTab({ tenderId }: { tenderId: number }) {
    const { hasPermission } = usePermissions();
    const { data, isLoading, error, refetch } = useComparativeStatement(tenderId);
    const generateMut = useGenerateComparative(tenderId);
    const canGenerate = hasPermission('award.recommend');

    const comparativeColumns: ColumnDef<any>[] = [
        {
            key: 'bidder',
            header: 'Bidder',
            cell: (b: any) => <span className="text-xs font-black text-slate-900 text-wrap-anywhere">{b.seller?.name}</span>
        },
        {
            key: 'technicalPercent',
            header: 'Tech',
            align: 'right',
            width: 'w-24',
            cellClassName: 'font-mono text-xs',
            cell: (b: any) => `${b.technicalPercent}%`
        },
        {
            key: 'quotedAmount',
            header: 'Quoted',
            align: 'right',
            width: 'w-32',
            cellClassName: 'font-mono text-xs',
            cell: (b: any) => formatCurrency(b.quotedAmount)
        },
        {
            key: 'evaluatedAmount',
            header: 'Final',
            align: 'right',
            width: 'w-32',
            cellClassName: 'font-mono text-xs font-bold',
            cell: (b: any) => formatCurrency(b.evaluatedAmount)
        },
        {
            key: 'rank',
            header: 'Rank',
            align: 'center',
            width: 'w-20',
            cellClassName: 'font-mono text-xs font-black',
            cell: (b: any) => (b.rank ? `L${b.rank}` : '—')
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            width: 'w-28',
            cell: (b: any) => b.qualified ? (
                <span className="text-[10px] font-black text-emerald-700">QUALIFIED</span>
            ) : (
                <span className="text-[10px] font-black text-red-700">DISQUALIFIED</span>
            )
        }
    ];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">
                    The comparative statement is the official record consolidating tech, financial, and ranking data.
                </p>
                {canGenerate && (
                    <Button
                        onClick={() => runWithToast(() => generateMut.mutateAsync(), {
                            loading: 'Generating...', success: 'Comparative statement generated', error: 'Failed'
                        })}
                        disabled={generateMut.isPending}
                        className="bg-[#12335f] text-white"
                    >
                        {generateMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Generate New Version
                    </Button>
                )}
            </div>

            {isLoading ? <LoadingState label="Loading..." /> :
                error ? <InlineError message={(error as Error).message} onRetry={() => refetch()} /> :
                    !data ? (
                        <Card><CardContent className="py-12">
                            <EmptyState title="No statement yet" description="Generate the comparative statement once technical and financial evaluations are complete." />
                        </CardContent></Card>
                    ) : (
                        <Card className="border-slate-200/80 min-w-0">
                            <CardContent className="p-5 space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Comparative Statement v{data.version}</p>
                                        <p className="mt-1 text-xs font-semibold text-slate-700">Generated {formatDateTime(data.createdAt)}</p>
                                    </div>
                                    {data.recommended && (
                                        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-800 shrink-0">
                                            <Award className="mr-1 h-3 w-3" /> Recommendation Available
                                        </span>
                                    )}
                                </div>

                                {data.summary?.bids && (
                                    <DataTable
                                        data={data.summary.bids}
                                        columns={comparativeColumns}
                                        showSrNo={false}
                                        minWidth="min-w-[600px]"
                                        keyExtractor={(b: any, idx) => b.bidId || idx}
                                        emptyTitle="No summary bids"
                                        emptyDescription="No bid details found in the comparative statement."
                                    />
                                )}
                            </CardContent>
                        </Card>
                    )
            }
        </div>
    );
}

