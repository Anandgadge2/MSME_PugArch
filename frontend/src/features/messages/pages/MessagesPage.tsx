'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    Archive,
    ArrowDown,
    ArrowLeft,
    BellOff,
    Check,
    CheckCheck,
    CheckCircle2,
    Clock,
    Copy,
    CornerUpLeft,
    FileCheck,
    FileText,
    Forward,
    ImageIcon,
    MessageSquare,
    Mic,
    Paperclip,
    Plus,
    RefreshCw,
    Search,
    Send,
    ShieldCheck,
    Smile,
    Trash2,
    UploadCloud,
    UserRound,
    X
} from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { Badge, Card, CardContent } from '../../../components/ui/card';
import { Input, Select } from '../../../components/ui/input';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { EmptyState, InlineError } from '../../shared/FeatureStates';
import { formatDateTime, formatRelative } from '../../shared/format';
import { runWithToast } from '../../../lib/toast';
import { compressImage } from '../../../lib/compress';
import { postApi } from '../../shared/apiClient';
import { uploadDeliveryFile as uploadMessageFile, type UploadedFileAsset } from '../../delivery/upload';
import {
    useArchiveConversation,
    useConversation,
    useConversations,
    useCreateConversation,
    useDeleteMessage,
    useMarkConversationRead,
    useMessageUserSearch,
    useMuteConversation,
    useSendMessage,
    useUnreadMessageCount
} from '../hooks';
import { fetchConversations, type ConversationDto, type MessageDto, type MessageUserDto } from '../api';
import MessageAttachmentView, { imageBlobUrlCache } from '../components/MessageAttachmentView';
import VoiceNoteRecorder from '../components/VoiceNoteRecorder';
import EmojiPickerPopover from '../components/EmojiPickerPopover';
import ForwardMessageModal from '../components/ForwardMessageModal';
import { useConversationRealtime } from '../hooks/useConversationRealtime';
import { cn } from '../../../lib/utils';

export const roleLabel = (role?: string) => (role || 'user').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const isAdminRole = (role?: string) => role === 'admin' || role === 'master_admin';
const MAX_MESSAGE_ATTACHMENT_SIZE = 20 * 1024 * 1024;

const formatFileSize = (size?: number) => {
    if (!size) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const roleBadgeClass = (role?: string) => {
    if (role === 'admin' || role === 'master_admin') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    if (role === 'buyer') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (role === 'seller' || role === 'shg') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
};

const routeForRole = (role?: string) => {
    if (role === 'seller' || role === 'shg') return '/seller/messages';
    if (isAdminRole(role)) return '/admin/messages';
    return '/buyer/messages';
};

const formatChatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today.getTime() - targetDay.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatChatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatLastSeen = (user?: MessageUserDto | null) => {
    if (!user) return 'Offline';
    const lastActive = user.lastLoginAt || user.updatedAt;
    if (!lastActive) return 'Offline';

    const d = new Date(lastActive);
    const diffMins = (Date.now() - d.getTime()) / (1000 * 60);

    if (diffMins < 5) return 'Online';
    if (diffMins < 60) return `Last seen ${Math.floor(diffMins)}m ago`;

    const now = new Date();
    const isToday = now.toDateString() === d.toDateString();
    if (isToday) {
        return `Last seen today at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    }
    return `Last seen on ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
};

/** Beautiful conversation list skeleton */
function ConversationListSkeleton() {
    return (
        <Card className="border-slate-200/80 shadow-sm flex flex-col h-[680px]">
            <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
                {/* Header Skeleton */}
                <div className="p-3 border-b border-slate-100 bg-white space-y-2">
                    <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="flex gap-2 pt-1">
                        <div className="h-7 w-14 animate-pulse rounded-lg bg-slate-100" />
                        <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-100" />
                        <div className="h-7 w-20 animate-pulse rounded-lg bg-slate-100" />
                    </div>
                </div>
                {/* Items */}
                <div className="flex-1 divide-y divide-slate-100 overflow-y-auto p-2 space-y-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl animate-pulse">
                            <div className="h-11 w-11 shrink-0 rounded-2xl bg-slate-200" />
                            <div className="flex-1 space-y-2 py-0.5 min-w-0">
                                <div className="flex items-center justify-between">
                                    <div className="h-3.5 w-28 rounded-md bg-slate-200" />
                                    <div className="h-2.5 w-12 rounded bg-slate-100" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-3 w-14 rounded-full bg-slate-100" />
                                    <div className="h-3 w-32 rounded bg-slate-100" />
                                </div>
                                <div className="h-3 w-4/5 rounded bg-slate-100" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/** Beautiful WhatsApp-style chat thread skeleton */
function ChatThreadSkeleton() {
    return (
        <Card className="flex h-full min-h-[680px] max-h-[760px] flex-col border-slate-200/80 shadow-sm overflow-hidden bg-[#efeae2]/40 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-200" />
                    <div className="space-y-1.5">
                        <div className="h-3.5 w-32 rounded bg-slate-200" />
                        <div className="h-2.5 w-24 rounded bg-slate-100" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-slate-100" />
                    <div className="h-8 w-8 rounded-lg bg-slate-100" />
                    <div className="h-8 w-8 rounded-lg bg-slate-100" />
                </div>
            </div>

            {/* Messages Thread Skeleton */}
            <div className="flex-1 p-4 space-y-4 overflow-hidden">
                {/* Date pill skeleton */}
                <div className="flex justify-center my-2">
                    <div className="h-5 w-20 rounded-full bg-slate-200/80" />
                </div>

                {/* Incoming bubble skeleton */}
                <div className="flex justify-start">
                    <div className="max-w-[70%] space-y-2 rounded-2xl rounded-bl-xs border border-slate-200 bg-white p-3.5 shadow-2xs">
                        <div className="h-3 w-20 rounded bg-emerald-100" />
                        <div className="h-3.5 w-48 rounded bg-slate-200" />
                        <div className="h-3 w-36 rounded bg-slate-100" />
                        <div className="flex justify-end pt-1">
                            <div className="h-2.5 w-10 rounded bg-slate-100" />
                        </div>
                    </div>
                </div>

                {/* Outgoing bubble skeleton */}
                <div className="flex justify-end">
                    <div className="max-w-[65%] space-y-2 rounded-2xl rounded-br-xs bg-[#12335f]/60 p-3.5 shadow-2xs">
                        <div className="h-3.5 w-44 rounded bg-white/30" />
                        <div className="h-3 w-28 rounded bg-white/20" />
                        <div className="flex justify-end pt-1">
                            <div className="h-2.5 w-12 rounded bg-white/20" />
                        </div>
                    </div>
                </div>

                {/* Incoming voice note skeleton */}
                <div className="flex justify-start">
                    <div className="flex items-center gap-3 rounded-2xl rounded-bl-xs border border-slate-200 bg-slate-100 p-3 shadow-2xs w-64">
                        <div className="h-9 w-9 rounded-full bg-slate-200" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-4 w-full rounded bg-slate-200" />
                            <div className="flex justify-between">
                                <div className="h-2 w-8 rounded bg-slate-200" />
                                <div className="h-2 w-8 rounded bg-slate-200" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Outgoing message bubble */}
                <div className="flex justify-end">
                    <div className="max-w-[60%] space-y-1.5 rounded-2xl rounded-br-xs bg-[#12335f]/60 p-3.5 shadow-2xs">
                        <div className="h-3.5 w-52 rounded bg-white/30" />
                        <div className="flex justify-end pt-1">
                            <div className="h-2.5 w-10 rounded bg-white/20" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Composer Skeleton */}
            <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
                <div className="h-10 w-10 rounded-full bg-slate-100" />
                <div className="h-10 w-10 rounded-full bg-slate-100" />
                <div className="h-10 flex-1 rounded-2xl bg-slate-100" />
                <div className="h-10 w-10 rounded-full bg-slate-200" />
            </div>
        </Card>
    );
}

export default function MessagesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname() || routeForRole(user?.role);
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const queryInitializedRef = useRef(false);
    const list = useConversations();
    const unread = useUnreadMessageCount();

    const conversations = list.data || [];
    const initialModalValues = useMemo(() => {
        const sellerId = searchParams?.get('sellerId') || '';
        const buyerId = searchParams?.get('buyerId') || '';
        const counterpartyId = searchParams?.get('counterpartyId') || '';
        const conversationId = Number(searchParams?.get('conversationId') || searchParams?.get('id') || 0);
        return {
            conversationId: Number.isFinite(conversationId) && conversationId > 0 ? conversationId : null,
            counterpartyId: user?.role === 'buyer' ? (sellerId || counterpartyId) : (buyerId || counterpartyId),
            recipientRole: sellerId ? 'seller' : buyerId ? 'buyer' : searchParams?.get('role') || '',
            subject: searchParams?.get('subject') || '',
            message: searchParams?.get('message') || '',
            intent: searchParams?.get('intent') || '',
            price: searchParams?.get('price') || '',
            productId: searchParams?.get('productId') || '',
            productName: searchParams?.get('productName') || ''
        };
    }, [searchParams, user?.role]);

    useEffect(() => {
        if (!initialModalValues.conversationId) return;
        setSelectedId(initialModalValues.conversationId);
    }, [initialModalValues.conversationId]);

    useEffect(() => {
        if (!user || queryInitializedRef.current || initialModalValues.conversationId) return;
        if (!initialModalValues.counterpartyId) return;
        queryInitializedRef.current = true;
        setShowCreate(true);
    }, [initialModalValues.counterpartyId, initialModalValues.conversationId, user]);

    const handleCreated = (id: number, conversation?: ConversationDto) => {
        if (conversation) {
            queryClient.setQueryData(['conversations', 'detail', id], conversation);
        }
        setShowCreate(false);
        setSelectedId(id);
        if (searchParams?.toString()) router.replace(pathname);
    };

    return (
        <div className="space-y-4">
            <div className="brand-tricolor-strip rounded-full" />
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-black text-slate-950">Messages & Chats</h1>
                        {isAdminRole(user?.role) && (
                            <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">
                                <ShieldCheck className="mr-1 h-3 w-3" /> Admin Console
                            </Badge>
                        )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                        Secure, real-time end-to-end communication for orders, tenders, quotations, and queries.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={unread.data?.unreadCount ? 'warning' : 'default'} className="h-9 rounded-lg px-3">
                        {unread.data?.unreadCount || 0} unread
                    </Badge>
                    <Button variant="outline" onClick={() => list.refetch()} className="h-10 text-xs font-black uppercase">
                        <RefreshCw className={`mr-2 h-4 w-4 ${list.isFetching ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    <Button onClick={() => setShowCreate(true)} className="bg-[#12335f] hover:bg-[#0b1f3a] text-white">
                        <Plus className="mr-2 h-4 w-4" /> New Chat
                    </Button>
                </div>
            </div>

            <div className="grid min-h-[680px] gap-3 xl:grid-cols-[380px_1fr]">
                <ConversationList
                    conversations={conversations}
                    selectedId={selectedId}
                    currentUserId={Number(user?.id || 0)}
                    isLoading={list.isLoading}
                    error={list.error}
                    onSelect={setSelectedId}
                    onRetry={() => list.refetch()}
                />

                <div className="min-h-[680px]">
                    {selectedId ? (
                        <ConversationDetail id={selectedId} onBack={() => setSelectedId(null)} />
                    ) : (
                        <Card className="h-full border-slate-200/80 shadow-sm bg-gradient-to-b from-slate-50/50 to-slate-100/30">
                            <CardContent className="flex h-full min-h-[680px] flex-col items-center justify-center py-16 text-center">
                                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 shadow-inner">
                                    <MessageSquare className="h-10 w-10" />
                                </div>
                                <h3 className="mt-4 text-base font-black text-slate-800">Select a Conversation</h3>
                                <p className="mt-1 max-w-sm text-xs font-semibold text-slate-500">
                                    Pick a chat from the left or start a new message with suppliers, buyers, or administrators.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {showCreate && (
                <CreateConversationModal
                    key={`${initialModalValues.counterpartyId}-${initialModalValues.subject}-${initialModalValues.recipientRole}-${initialModalValues.intent}`}
                    initialCounterpartyId={initialModalValues.counterpartyId}
                    initialRecipientRole={initialModalValues.recipientRole}
                    initialSubject={initialModalValues.subject}
                    initialMessage={initialModalValues.message}
                    initialIntent={initialModalValues.intent}
                    initialPrice={initialModalValues.price}
                    onClose={() => setShowCreate(false)}
                    onCreated={handleCreated}
                />
            )}
        </div>
    );
}

function ConversationList({
    conversations,
    selectedId,
    currentUserId,
    isLoading,
    error,
    onSelect,
    onRetry
}: {
    conversations: ConversationDto[];
    selectedId: number | null;
    currentUserId: number;
    isLoading: boolean;
    error: any;
    onSelect: (id: number) => void;
    onRetry: () => void;
}) {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<'all' | 'active' | 'unread' | 'archived'>('active');
    const [role, setRole] = useState('all');

    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase();
        return conversations.filter(conversation => {
            const isArchived = conversation.status === 'archived';
            if (status === 'active' && isArchived) return false;
            if (status === 'archived' && !isArchived) return false;
            if (status === 'unread' && (!conversation.unreadCount || conversation.unreadCount === 0)) return false;

            const parties = [conversation.buyer, conversation.seller].filter(Boolean) as MessageUserDto[];
            if (role !== 'all' && !parties.some(user => user.role === role)) return false;
            if (!term) return true;
            const haystack = [
                conversation.subject,
                conversation.tender?.tenderId,
                conversation.tender?.title,
                conversation.messages?.[0]?.content,
                ...parties.map(user => `${user.name} ${user.email || ''} ${user.role}`)
            ].join(' ').toLowerCase();
            return haystack.includes(term);
        });
    }, [conversations, query, role, status]);

    if (isLoading) return <ConversationListSkeleton />;
    if (error) return <InlineError message={(error as Error).message} onRetry={onRetry} />;

    const unreadTotal = conversations.filter(c => (c.unreadCount || 0) > 0).length;

    return (
        <Card className="border-slate-200/80 shadow-sm flex flex-col h-[680px] max-h-[760px]">
            <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
                {/* Search & Filter Header */}
                <div className="p-3 border-b border-slate-100 bg-white space-y-2.5">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Search chats, suppliers, tenders..."
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* WhatsApp-Style Filter Pills */}
                    <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setStatus('active')}
                                className={cn(
                                    'rounded-full px-3 py-1 text-xs font-bold transition',
                                    status === 'active'
                                        ? 'bg-[#12335f] text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                )}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatus('unread')}
                                className={cn(
                                    'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition',
                                    status === 'unread'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                )}
                            >
                                <span>Unread</span>
                                {unreadTotal > 0 && (
                                    <span className={cn(
                                        'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black',
                                        status === 'unread' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
                                    )}>
                                        {unreadTotal}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatus('archived')}
                                className={cn(
                                    'rounded-full px-3 py-1 text-xs font-bold transition',
                                    status === 'archived'
                                        ? 'bg-slate-700 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                )}
                            >
                                Archived
                            </button>
                        </div>

                        {/* Role selector dropdown */}
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            aria-label="Filter conversations by role"
                            className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-600 outline-none hover:border-slate-300"
                        >
                            <option value="all">All Roles</option>
                            <option value="buyer">Buyers</option>
                            <option value="seller">Sellers</option>
                            <option value="shg">SHG</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>

                {/* Conversation List Items */}
                {filtered.length === 0 ? (
                    <div className="p-6 text-center">
                        <EmptyState title="No conversations found" description="You have no chats matching this query." />
                    </div>
                ) : (
                    <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
                        {filtered.map(conversation => {
                            const lastMessage = conversation.messages?.[0];
                            const isSelected = selectedId === conversation.id;
                            const counterpart = conversation.buyerId === currentUserId ? conversation.seller : conversation.buyer;
                            const isOnline = formatLastSeen(counterpart) === 'Online';

                            return (
                                <button
                                    key={conversation.id}
                                    type="button"
                                    onClick={() => onSelect(conversation.id)}
                                    className={cn(
                                        'w-full px-4 py-3.5 text-left transition flex items-start gap-3 hover:bg-slate-50/80',
                                        isSelected ? 'border-l-4 border-emerald-600 bg-emerald-50/40' : ''
                                    )}
                                >
                                    {/* Counterpart Avatar with Online Badge */}
                                    <div className="relative shrink-0">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#12335f] to-[#1c4d8c] text-white font-black text-sm shadow-xs">
                                            {counterpart?.name?.charAt(0)?.toUpperCase() || 'U'}
                                        </div>
                                        {isOnline && (
                                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-xs" />
                                        )}
                                    </div>

                                    {/* Conversation Details */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className="truncate text-xs font-black text-slate-900">
                                                {counterpart?.name || 'User'}
                                            </p>
                                            {conversation.lastMessageAt && (
                                                <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                                                    {formatRelative(conversation.lastMessageAt)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-0.5 flex items-center gap-1.5">
                                            {counterpart && (
                                                <span className={cn('rounded-full border px-1.5 py-0.2 text-[9px] font-black uppercase', roleBadgeClass(counterpart.role))}>
                                                    {roleLabel(counterpart.role)}
                                                </span>
                                            )}
                                            <span className="truncate text-[10px] font-bold text-slate-400">
                                                {conversation.subject}
                                            </span>
                                        </div>

                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <p className="line-clamp-1 text-[11px] font-medium text-slate-600">
                                                {lastMessage ? (
                                                    lastMessage.status === 'deleted' ? (
                                                        <span className="italic text-slate-400">🚫 This message was deleted</span>
                                                    ) : (
                                                        lastMessage.content || `${lastMessage.attachments?.length || 0} attachment(s)`
                                                    )
                                                ) : (
                                                    'No messages yet'
                                                )}
                                            </p>
                                            {Boolean(conversation.unreadCount) && (
                                                <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                                                    {conversation.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ConversationDetail({ id, onBack }: { id: number; onBack: () => void }) {
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: conversation, isLoading, error, refetch } = useConversation(id);
    useConversationRealtime(id);
    const sendMut = useSendMessage();
    const deleteMut = useDeleteMessage();
    const markRead = useMarkConversationRead();
    const archive = useArchiveConversation();
    const mute = useMuteConversation();

    const [content, setContent] = useState('');
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [forwardMessageItem, setForwardMessageItem] = useState<MessageDto | null>(null);
    const [replyingTo, setReplyingTo] = useState<MessageDto | null>(null);
    const [searchChatText, setSearchChatText] = useState('');
    const [showSearchInChat, setShowSearchInChat] = useState(false);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const docInputRef = useRef<HTMLInputElement | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const [uploadedAttachments, setUploadedAttachments] = useState<UploadedFileAsset[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<Array<{ id: string; name: string; progress: number }>>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);

    useEffect(() => {
        if (conversation?.id && conversation.unreadCount) {
            markRead.mutate(conversation.id);
        }
    }, [conversation?.id, conversation?.unreadCount]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [conversation?.messages?.length]);

    // Filter messages if searching within chat (Unconditionally called before any returns)
    const rawMessages = conversation?.messages || [];
    const displayedMessages = useMemo(() => {
        if (!searchChatText.trim()) return rawMessages;
        const term = searchChatText.toLowerCase();
        return rawMessages.filter(m => m.content?.toLowerCase().includes(term));
    }, [rawMessages, searchChatText]);

    const handleScroll = () => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 200);
    };

    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    if (isLoading) return <ChatThreadSkeleton />;
    if (error) return <InlineError message={(error as Error).message} onRetry={() => refetch()} />;
    if (!conversation) return null;

    const buyer = conversation.buyer;
    const seller = conversation.seller;
    const counterpart = conversation.buyerId === Number(user?.id) ? seller : buyer;
    const hasComposerContent = content.trim().length > 0 || uploadedAttachments.length > 0;
    const isUploading = uploadingFiles.length > 0;
    const lastSeenText = formatLastSeen(counterpart);
    const isCounterpartOnline = lastSeenText === 'Online';

    const handleAttachmentFiles = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (files.length === 0) return;
        setUploadError(null);

        const uploadTasks = files.map(async (file) => {
            const uploadId = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
            setUploadingFiles(current => [...current, { id: uploadId, name: file.name, progress: 0 }]);
            try {
                let uploadFile: File = file;
                if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
                    const compressed = await compressImage(file, 1400, 1400, 0.75);
                    uploadFile = new File([compressed], file.name, { type: compressed.type || file.type });
                }
                if (uploadFile.size > MAX_MESSAGE_ATTACHMENT_SIZE) {
                    throw new Error(`${file.name} exceeds 20 MB limit`);
                }
                const uploaded = await uploadMessageFile(uploadFile, {
                    entityType: 'message',
                    onProgress: percent => {
                        setUploadingFiles(current => current.map(item => item.id === uploadId ? { ...item, progress: percent } : item));
                    }
                });
                if (file.type.startsWith('image/')) {
                    imageBlobUrlCache.set(uploaded.id, URL.createObjectURL(uploadFile));
                }
                setUploadedAttachments(current => [...current, { ...uploaded, originalName: file.name }]);
            } catch (err) {
                const message = err instanceof Error ? err.message : `Unable to upload ${file.name}`;
                setUploadError(message);
                throw err;
            } finally {
                setUploadingFiles(current => current.filter(item => item.id !== uploadId));
            }
        });

        await Promise.allSettled(uploadTasks);
    };

    const handleSend = async () => {
        const messageText = content.trim();
        if (!messageText && uploadedAttachments.length === 0) return;
        if (isUploading) return;

        const attachmentsToSend = uploadedAttachments;
        const fileAssetIds = attachmentsToSend.map(attachment => attachment.id).filter(value => Number.isFinite(value) && value > 0);

        let finalContent = messageText;
        if (replyingTo) {
            const replyAuthor = replyingTo.senderId === Number(user?.id) ? 'You' : replyingTo.sender?.name || 'User';
            finalContent = `[Replying to ${replyAuthor}: "${replyingTo.content?.slice(0, 80) || 'Attachment'}"]\n${messageText}`;
        }

        const optimisticId = -Date.now();
        const optimisticMessage: MessageDto = {
            id: optimisticId,
            conversationId: conversation.id,
            senderId: Number(user?.id),
            content: finalContent,
            status: 'sending',
            createdAt: new Date().toISOString(),
            sender: user ? { id: Number(user.id), name: user.name || 'You', email: user.email, role: user.role } : undefined,
            attachments: attachmentsToSend.map((attachment, index) => ({
                id: -(index + 1),
                fileAssetId: attachment.id,
                fileAsset: {
                    id: attachment.id,
                    originalName: attachment.originalName,
                    mimeType: attachment.mimeType,
                    size: attachment.size
                }
            })),
            pending: true
        };

        setContent('');
        setReplyingTo(null);
        setUploadedAttachments([]);

        queryClient.setQueryData<ConversationDto>(['conversations', 'detail', conversation.id], current => current ? ({
            ...current,
            lastMessageAt: optimisticMessage.createdAt,
            messages: [...(current.messages || []), optimisticMessage]
        }) : current);

        try {
            const saved = await sendMut.mutateAsync({ id: conversation.id, data: { content: finalContent, fileAssetIds } });
            const assetsById = new Map(attachmentsToSend.map(attachment => [attachment.id, attachment]));
            const enrichedSaved: MessageDto = {
                ...saved,
                attachments: saved.attachments?.map(attachment => ({
                    ...attachment,
                    fileAsset: attachment.fileAsset || assetsById.get(attachment.fileAssetId)
                }))
            };
            queryClient.setQueryData<ConversationDto>(['conversations', 'detail', conversation.id], current => current ? ({
                ...current,
                lastMessageAt: enrichedSaved.createdAt || optimisticMessage.createdAt,
                messages: (current.messages || []).map(message => message.id === optimisticId ? enrichedSaved : message)
            }) : current);
        } catch (err) {
            queryClient.setQueryData<ConversationDto>(['conversations', 'detail', conversation.id], current => current ? ({
                ...current,
                messages: (current.messages || []).filter(message => message.id !== optimisticId)
            }) : current);
            setContent(messageText);
            setUploadedAttachments(attachmentsToSend);
            toast.error(err instanceof Error ? err.message : 'Unable to send message');
        }
    };

    const handleDeleteMessage = async (msg: MessageDto) => {
        const isMyMessage = msg.senderId === Number(user?.id);
        const ageMs = Date.now() - new Date(msg.createdAt).getTime();
        const canDeleteForEveryone = isMyMessage && ageMs <= 10 * 60 * 1000;

        if (canDeleteForEveryone) {
            if (confirm('Delete this message for everyone in the chat?')) {
                // Optimistic instant 0ms update
                const prevData = queryClient.getQueryData<ConversationDto>(['conversations', 'detail', conversation.id]);
                queryClient.setQueryData<ConversationDto>(['conversations', 'detail', conversation.id], current => current ? ({
                    ...current,
                    messages: (current.messages || []).map(m => m.id === msg.id ? {
                        ...m,
                        status: 'deleted',
                        content: 'This message was deleted',
                        attachments: []
                    } : m)
                }) : current);
                toast.success('Message deleted for everyone');

                try {
                    await deleteMut.mutateAsync({ conversationId: conversation.id, messageId: msg.id });
                } catch (err) {
                    if (prevData) {
                        queryClient.setQueryData(['conversations', 'detail', conversation.id], prevData);
                    }
                    toast.error(err instanceof Error ? err.message : 'Unable to delete message on server');
                }
            }
        } else {
            // Delete for me
            if (confirm('Delete this message for you?')) {
                queryClient.setQueryData<ConversationDto>(['conversations', 'detail', conversation.id], current => current ? ({
                    ...current,
                    messages: (current.messages || []).filter(m => m.id !== msg.id)
                }) : current);
                toast.success('Message deleted for you');
            }
        }
    };

    const handleCopyMessage = (text?: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    return (
        <Card className="flex h-full min-h-[680px] max-h-[760px] flex-col border-slate-200/80 shadow-sm overflow-hidden bg-[#efeae2]/40">
            <CardContent className="flex flex-1 flex-col p-0 overflow-hidden">
                {/* Modern Chat Header */}
                <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-2xs">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <button onClick={onBack} className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-[#12335f] hover:underline xl:hidden">
                                <ArrowLeft className="mr-1 h-4 w-4" /> Back
                            </button>

                            {/* Counterpart Avatar */}
                            <div className="relative shrink-0">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#12335f] to-[#1c4d8c] text-white font-black text-sm">
                                    {counterpart?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                {isCounterpartOnline && (
                                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-xs" />
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="truncate text-sm font-black text-slate-950">{counterpart?.name || 'Chat'}</h2>
                                    {counterpart?.role && (
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-black uppercase', roleBadgeClass(counterpart.role))}>
                                            {roleLabel(counterpart.role)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn('text-[11px] font-semibold', isCounterpartOnline ? 'text-emerald-600 font-black' : 'text-slate-400')}>
                                        {lastSeenText}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="truncate text-[11px] font-bold text-slate-500">{conversation.subject}</span>
                                </div>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSearchInChat(!showSearchInChat)}
                                className="h-8 px-2 text-slate-600 hover:bg-slate-100"
                                title="Search in chat"
                            >
                                <Search className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => runWithToast(() => markRead.mutateAsync(conversation.id), { loading: 'Marking read...', success: 'Marked read', error: 'Unable to mark read' })}
                                className="h-8 px-2 text-slate-600 hover:bg-slate-100"
                                title="Mark all read"
                            >
                                <CheckCheck className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => runWithToast(() => mute.mutateAsync({ id: conversation.id, muted: !conversation.muted }), { loading: 'Updating...', success: conversation.muted ? 'Unmuted' : 'Muted', error: 'Unable to update mute setting' })}
                                className="h-8 px-2 text-slate-600 hover:bg-slate-100"
                                title={conversation.muted ? 'Unmute notifications' : 'Mute notifications'}
                            >
                                <BellOff className={cn('h-4 w-4', conversation.muted ? 'text-amber-600' : 'text-slate-400')} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => runWithToast(() => archive.mutateAsync(conversation.id), { loading: 'Archiving...', success: 'Archived', error: 'Unable to archive' })}
                                className="h-8 px-2 text-slate-600 hover:bg-slate-100"
                                title="Archive chat"
                            >
                                <Archive className="h-4 w-4 text-slate-500" />
                            </Button>
                        </div>
                    </div>

                    {/* In-chat search bar toggle */}
                    {showSearchInChat && (
                        <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 animate-in fade-in">
                            <Search className="h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={searchChatText}
                                onChange={e => setSearchChatText(e.target.value)}
                                placeholder="Search messages in this chat..."
                                className="h-7 w-full bg-transparent text-xs font-semibold outline-none"
                                autoFocus
                            />
                            {searchChatText && (
                                <button type="button" onClick={() => setSearchChatText('')} className="text-slate-400 hover:text-slate-600">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* RFQ / Tender Integration banner if present */}
                {(() => {
                    const isQuoteRequest = Boolean(
                        conversation.quoteRequest ||
                        conversation.subject?.toLowerCase().includes('quote request')
                    );
                    if (!isQuoteRequest) return null;

                    const quoteReqId = conversation.quoteRequest?.id || (() => {
                        const m = conversation.subject?.match(/Quote Request #(\d+)/i);
                        return m ? Number(m[1]) : null;
                    })();

                    const submittedQuote = conversation.quoteRequest?.quoteResponses?.find((r: any) => r.status === 'SUBMITTED' || r.status === 'ACCEPTED') || conversation.quoteRequest?.quoteResponses?.[0];
                    const isSeller = user?.role === 'seller';
                    const isBuyer = user?.role === 'buyer';

                    return (
                        <div className="flex flex-col gap-2 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-slate-50 px-4 py-2 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#12335f] text-white">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[11px] font-black uppercase text-[#12335f]">
                                            {quoteReqId ? `RFQ #${quoteReqId}` : 'Quote Request'}
                                        </span>
                                        {submittedQuote && (
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-800">
                                                ₹{Number(submittedQuote.totalAmount || 0).toLocaleString('en-IN')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isSeller && (
                                    <Button
                                        size="sm"
                                        className="h-7 bg-[#12335f] text-[11px] text-white hover:bg-[#0b1f3a]"
                                        onClick={() => {
                                            const url = quoteReqId
                                                ? `/seller/rfq/submit-quotation?conversationId=${conversation.id}&quoteRequestId=${quoteReqId}`
                                                : `/seller/rfq/submit-quotation?conversationId=${conversation.id}`;
                                            router.push(url);
                                        }}
                                    >
                                        <FileCheck className="mr-1 h-3.5 w-3.5" />
                                        {submittedQuote ? 'Edit Quote' : 'Create Quote'}
                                    </Button>
                                )}
                                {isBuyer && submittedQuote && (
                                    <Button
                                        size="sm"
                                        className="h-7 bg-emerald-600 text-[11px] text-white hover:bg-emerald-700"
                                        onClick={() => {
                                            const targetId = quoteReqId || conversation.quoteRequest?.id;
                                            if (targetId) {
                                                router.push(`/buyer/rfq/${targetId}/compare?conversationId=${conversation.id}`);
                                            } else {
                                                router.push(`/buyer/rfq/compare?conversationId=${conversation.id}`);
                                            }
                                        }}
                                    >
                                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Accept Quote
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* Main WhatsApp-Style Message Thread */}
                <div
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                    className="relative flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]"
                >
                    {displayedMessages.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-xs font-semibold text-slate-400">
                            <div className="rounded-full bg-white p-3 shadow-xs">
                                <Smile className="h-6 w-6 text-slate-300" />
                            </div>
                            <p className="mt-2">No messages in this chat. Start communicating below.</p>
                        </div>
                    ) : (
                        (() => {
                            let lastDate = '';
                            return displayedMessages.map((message) => {
                                const isMe = message.senderId === Number(user?.id);
                                const isDeleted = message.status === 'deleted';
                                const msgDate = formatChatDateHeader(message.createdAt);
                                const showDateHeader = msgDate !== lastDate;
                                lastDate = msgDate;

                                return (
                                    <div key={message.id} className="space-y-3">
                                        {/* Sticky Date Pill */}
                                        {showDateHeader && (
                                            <div className="flex justify-center my-2">
                                                <span className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-2xs backdrop-blur-xs">
                                                    {msgDate}
                                                </span>
                                            </div>
                                        )}

                                        {/* Bubble Container */}
                                        <div className={cn('group flex items-end gap-1.5', isMe ? 'justify-end' : 'justify-start')}>
                                            {/* Hover Action Bar for Sender (Left of bubble) */}
                                            {isMe && !isDeleted && (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 border border-slate-200 rounded-full px-1.5 py-0.5 shadow-xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setReplyingTo(message)}
                                                        className="p-1 text-slate-500 hover:text-slate-800"
                                                        title="Reply"
                                                    >
                                                        <CornerUpLeft className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setForwardMessageItem(message)}
                                                        className="p-1 text-slate-500 hover:text-emerald-600"
                                                        title="Forward"
                                                    >
                                                        <Forward className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyMessage(message.content)}
                                                        className="p-1 text-slate-500 hover:text-blue-600"
                                                        title="Copy text"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteMessage(message)}
                                                        className="p-1 text-slate-500 hover:text-rose-600"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* The Message Bubble */}
                                            <div
                                                className={cn(
                                                    'relative max-w-[85%] sm:max-w-[72%] rounded-2xl px-3.5 py-2 text-xs shadow-xs transition',
                                                    isMe
                                                        ? 'bg-[#12335f] text-white rounded-br-xs'
                                                        : 'bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs'
                                                )}
                                            >
                                                {/* Header name if counterparty in group/chat */}
                                                {!isMe && (
                                                    <div className="mb-1 flex items-center gap-1.5">
                                                        <span className="text-[11px] font-black text-emerald-700">
                                                            {message.sender?.name || 'User'}
                                                        </span>
                                                        {message.sender?.role && (
                                                            <span className={cn('rounded-full border px-1.5 py-0.2 text-[8px] font-black uppercase', roleBadgeClass(message.sender?.role))}>
                                                                {roleLabel(message.sender?.role)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Replying quote text snippet if present */}
                                                {message.content?.startsWith('[Replying to') && (
                                                    <div className={cn('mb-1.5 rounded-lg border-l-3 px-2 py-1 text-[11px]', isMe ? 'border-emerald-400 bg-white/10 text-white/90' : 'border-emerald-600 bg-slate-100 text-slate-700')}>
                                                        <p className="line-clamp-2 italic">{message.content.split('\n')[0]}</p>
                                                    </div>
                                                )}

                                                {/* Content */}
                                                {isDeleted ? (
                                                    <p className="italic text-white/60 text-[11px]">🚫 This message was deleted</p>
                                                ) : (
                                                    <p className="whitespace-pre-wrap font-medium leading-relaxed text-wrap-anywhere">
                                                        {message.content?.startsWith('[Replying to') ? message.content.split('\n').slice(1).join('\n') : message.content}
                                                    </p>
                                                )}

                                                {/* Attachments (Images, PDF, Word, Voice Notes) */}
                                                {!isDeleted && Boolean(message.attachments?.length) && (
                                                    <div className="mt-1 space-y-1">
                                                        {message.attachments!.map(attachment => (
                                                            <MessageAttachmentView key={attachment.id} attachment={attachment} isMe={isMe} />
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Bottom Time & WhatsApp Status Ticks */}
                                                <div className={cn('mt-1 flex items-center justify-end gap-1 text-[9px]', isMe ? 'text-white/70' : 'text-slate-400')}>
                                                    <span>{formatChatTime(message.createdAt)}</span>
                                                    {isMe && !isDeleted && (
                                                        <span className="inline-flex items-center" title={message.status === 'read' ? 'Read by recipient' : message.status === 'delivered' ? 'Delivered' : 'Sent'}>
                                                            {message.pending ? (
                                                                <Clock className="h-3 w-3 animate-pulse text-white/60" />
                                                            ) : message.status === 'read' ? (
                                                                <CheckCheck className="h-3.5 w-3.5 text-cyan-300 stroke-[2.5]" />
                                                            ) : message.status === 'delivered' ? (
                                                                <CheckCheck className="h-3.5 w-3.5 text-white/70 stroke-[2.5]" />
                                                            ) : (
                                                                <Check className="h-3.5 w-3.5 text-white/70 stroke-[2.5]" />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Hover Action Bar for Counterparty (Right of bubble) */}
                                            {!isMe && !isDeleted && (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 border border-slate-200 rounded-full px-1.5 py-0.5 shadow-xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setReplyingTo(message)}
                                                        className="p-1 text-slate-500 hover:text-slate-800"
                                                        title="Reply"
                                                    >
                                                        <CornerUpLeft className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setForwardMessageItem(message)}
                                                        className="p-1 text-slate-500 hover:text-emerald-600"
                                                        title="Forward"
                                                    >
                                                        <Forward className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyMessage(message.content)}
                                                        className="p-1 text-slate-500 hover:text-blue-600"
                                                        title="Copy text"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteMessage(message)}
                                                        className="p-1 text-slate-500 hover:text-rose-600"
                                                        title="Delete for me"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            });
                        })()
                    )}

                    {/* Floating Scroll to Bottom Button */}
                    {showScrollBottom && (
                        <button
                            type="button"
                            onClick={scrollToBottom}
                            className="sticky bottom-4 left-full flex h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 transition active:scale-95"
                            title="Scroll to latest"
                        >
                            <ArrowDown className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Quoted Reply Banner */}
                {replyingTo && (
                    <div className="flex items-center justify-between border-t border-emerald-100 bg-emerald-50/80 px-4 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <CornerUpLeft className="h-4 w-4 text-emerald-700 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase text-emerald-800">
                                    Replying to {replyingTo.senderId === Number(user?.id) ? 'Yourself' : replyingTo.sender?.name || 'User'}
                                </p>
                                <p className="truncate text-xs font-semibold text-slate-600">
                                    {replyingTo.content || 'Attachment'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="p-1 text-slate-400 hover:text-slate-700"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* WhatsApp-Style Input Composer */}
                <div className="border-t border-slate-200 bg-white p-3">
                    {/* If recording voice note, show the VoiceNoteRecorder banner */}
                    {isRecordingVoice ? (
                        <VoiceNoteRecorder
                            onRecorded={(uploadedAsset) => {
                                setUploadedAttachments(prev => [...prev, uploadedAsset]);
                                setIsRecordingVoice(false);
                            }}
                            onCancel={() => setIsRecordingVoice(false)}
                        />
                    ) : (
                        <div className="relative flex items-end gap-2">
                            {/* Emoji Picker Popover */}
                            {showEmojiPicker && (
                                <EmojiPickerPopover
                                    onSelectEmoji={(emoji) => {
                                        setContent(prev => prev + emoji);
                                        if (textareaRef.current) textareaRef.current.focus();
                                    }}
                                    onClose={() => setShowEmojiPicker(false)}
                                />
                            )}

                            {/* Emoji Toggle Button */}
                            <button
                                type="button"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                                title="Add emoji"
                            >
                                <Smile className="h-5 w-5" />
                            </button>

                            {/* Hidden Inputs for Attachments */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleAttachmentFiles}
                                accept="image/*,video/*"
                            />
                            <input
                                ref={docInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleAttachmentFiles}
                                accept="application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                            />

                            {/* Attachment Menus */}
                            <button
                                type="button"
                                onClick={() => docInputRef.current?.click()}
                                disabled={sendMut.isPending || isUploading}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                                title="Attach Document (PDF / Word / Excel)"
                            >
                                <Paperclip className="h-5 w-5" />
                            </button>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sendMut.isPending || isUploading}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                                title="Attach Image / Photo"
                            >
                                <ImageIcon className="h-5 w-5" />
                            </button>

                            {/* Message Text Input */}
                            <div className="relative flex-1">
                                <textarea
                                    ref={textareaRef}
                                    value={content}
                                    onChange={event => setContent(event.target.value)}
                                    placeholder={`Type a message to ${counterpart?.name || 'user'}... (Enter to send)`}
                                    rows={1}
                                    maxLength={2000}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter' && !event.shiftKey) {
                                            event.preventDefault();
                                            void handleSend();
                                        }
                                    }}
                                    className="max-h-32 min-h-[42px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
                                />
                            </div>

                            {/* Send or Mic Button */}
                            {hasComposerContent ? (
                                <button
                                    type="button"
                                    onClick={handleSend}
                                    disabled={sendMut.isPending || isUploading}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                                    title="Send message"
                                >
                                    {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsRecordingVoice(true)}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#12335f] text-white shadow-md hover:bg-[#0b1f3a] active:scale-95 transition"
                                    title="Record voice note"
                                >
                                    <Mic className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Uploading progress and staged attachments */}
                    {(uploadedAttachments.length > 0 || uploadingFiles.length > 0 || uploadError) && (
                        <div className="mt-2 space-y-1.5">
                            {uploadError && (
                                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
                                    {uploadError}
                                </div>
                            )}
                            {uploadingFiles.map(file => (
                                <div key={file.id} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5">
                                    <div className="flex items-center justify-between gap-3 text-xs font-bold text-blue-900">
                                        <span className="min-w-0 truncate">{file.name}</span>
                                        <span>{file.progress}%</span>
                                    </div>
                                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white">
                                        <div className="h-full rounded-full bg-[#12335f]" style={{ width: `${Math.max(4, file.progress)}%` }} />
                                    </div>
                                </div>
                            ))}
                            {uploadedAttachments.map(attachment => (
                                <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                                    <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-700">
                                        <UploadCloud className="h-4 w-4 shrink-0 text-emerald-600" />
                                        <span className="min-w-0 truncate">{attachment.originalName || `Asset #${attachment.id}`}</span>
                                        {attachment.size ? <span className="shrink-0 text-slate-400">{formatFileSize(attachment.size)}</span> : null}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setUploadedAttachments(current => current.filter(item => item.id !== attachment.id))}
                                        className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-rose-600"
                                        aria-label="Remove attachment"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Forward Message Modal */}
            {forwardMessageItem && (
                <ForwardMessageModal
                    message={forwardMessageItem}
                    currentUserId={Number(user?.id || 0)}
                    onClose={() => setForwardMessageItem(null)}
                />
            )}
        </Card>
    );
}

const getUserCompanyName = (u?: MessageUserDto | null): string => {
    if (!u) return '';
    return (
        u.organization?.organizationName ||
        u.organization?.name ||
        u.buyerProfile?.organizationName ||
        u.sellerProfile?.businessName ||
        u.company?.name ||
        u.company?.portalDisplayName ||
        ''
    );
};

const getUserOptionLabel = (u: MessageUserDto): string => {
    const comp = getUserCompanyName(u);
    if (comp && comp.trim().toLowerCase() !== u.name.trim().toLowerCase()) {
        return `${comp} (${u.name})`;
    }
    return u.name;
};

export function CreateConversationModal({
    onClose,
    onCreated,
    initialCounterpartyId,
    initialRecipientRole,
    initialSubject = '',
    initialMessage = '',
    initialIntent,
    initialPrice
}: {
    onClose: () => void;
    onCreated: (id: number, conversation?: ConversationDto) => void;
    initialCounterpartyId?: string;
    initialRecipientRole?: string;
    initialSubject?: string;
    initialMessage?: string;
    initialIntent?: string;
    initialPrice?: string;
}) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [recipientRole, setRecipientRole] = useState(initialRecipientRole || (user?.role === 'buyer' ? 'seller' : 'buyer'));
    const [counterpartyId, setCounterpartyId] = useState<number | ''>(() => {
        const id = Number(initialCounterpartyId);
        return Number.isFinite(id) && id > 0 ? id : '';
    });
    const [filterQuery, setFilterQuery] = useState('');
    const [subject, setSubject] = useState(initialSubject);
    const [message, setMessage] = useState(initialMessage);
    const mut = useCreateConversation();
    const users = useMessageUserSearch({ role: recipientRole }, true);
    const isPrefilledCounterparty = Boolean(initialCounterpartyId);
    const isMarketplaceQuoteRequest = Boolean(
        isPrefilledCounterparty &&
        (initialIntent === 'quote' || initialSubject.toLowerCase().startsWith('quote request:') || initialMessage.toLowerCase().includes('request a quotation'))
    );
    const recipientLabel = recipientRole === 'seller' ? 'seller' : recipientRole === 'buyer' ? 'buyer' : roleLabel(recipientRole);

    const sortedUsers = useMemo(() => {
        if (!users.data) return [];
        return [...users.data].sort((a, b) => {
            const labelA = getUserOptionLabel(a);
            const labelB = getUserOptionLabel(b);
            return labelA.localeCompare(labelB, undefined, { sensitivity: 'base', numeric: true });
        });
    }, [users.data]);

    const filteredUsers = useMemo(() => {
        if (!filterQuery.trim()) return sortedUsers;
        const term = filterQuery.trim().toLowerCase();
        return sortedUsers.filter(candidate => {
            const comp = getUserCompanyName(candidate).toLowerCase();
            const name = candidate.name.toLowerCase();
            const email = (candidate.email || '').toLowerCase();
            return comp.includes(term) || name.includes(term) || email.includes(term);
        });
    }, [sortedUsers, filterQuery]);

    const payloadForRole = () => {
        if (!counterpartyId) return null;
        if (recipientRole === 'seller') return { sellerId: counterpartyId as number, subject: subject.trim(), initialMessage: message.trim() || undefined };
        return { buyerId: counterpartyId as number, subject: subject.trim(), initialMessage: message.trim() || undefined };
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] px-5 py-4 text-white">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">{isMarketplaceQuoteRequest ? 'Request Quote' : 'New Conversation'}</h3>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-4 p-5">
                    {isPrefilledCounterparty ? (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2.5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Recipient</p>
                            <p className="mt-1 text-xs font-bold text-blue-950">
                                {isMarketplaceQuoteRequest
                                    ? `This quote request will be sent to the listing ${recipientLabel}.`
                                    : `This conversation will be sent to the selected ${recipientLabel}.`}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Select
                                    label="Recipient Role"
                                    value={recipientRole}
                                    onChange={event => {
                                        setRecipientRole(event.target.value);
                                        setCounterpartyId('');
                                        setFilterQuery('');
                                    }}
                                >
                                    <option value="buyer">Buyer</option>
                                    <option value="seller">Seller</option>
                                    <option value="shg">SHG</option>
                                    {isAdminRole(user?.role) && <option value="admin">Admin</option>}
                                </Select>
                                <Select
                                    label={`Select ${recipientRole === 'seller' ? 'Seller' : recipientRole === 'buyer' ? 'Buyer' : 'Recipient'}`}
                                    value={counterpartyId}
                                    onChange={event => setCounterpartyId(event.target.value === '' ? '' : Number(event.target.value))}
                                    disabled={users.isLoading}
                                >
                                    <option value="">
                                        {users.isLoading
                                            ? `Loading ${recipientRole === 'seller' ? 'sellers' : recipientRole === 'buyer' ? 'buyers' : 'users'}...`
                                            : filteredUsers.length === 0
                                                ? `No ${recipientRole === 'seller' ? 'sellers' : recipientRole === 'buyer' ? 'buyers' : 'users'} found`
                                                : `-- Select ${recipientRole === 'seller' ? 'Seller' : recipientRole === 'buyer' ? 'Buyer' : 'Recipient'} --`}
                                    </option>
                                    {filteredUsers.map(candidate => (
                                        <option key={candidate.id} value={candidate.id}>
                                            {getUserOptionLabel(candidate)}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            {sortedUsers.length > 5 && (
                                <Input
                                    label="Search Recipient"
                                    value={filterQuery}
                                    onChange={event => setFilterQuery(event.target.value)}
                                    placeholder="Filter by company name, user name, email..."
                                />
                            )}
                        </div>
                    )}
                    <Input
                        label="Subject"
                        value={subject}
                        onChange={event => setSubject(event.target.value)}
                        placeholder="Tender clarification, delivery issue, quote inquiry..."
                        maxLength={160}
                    />
                    <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">First Message</label>
                        <textarea
                            value={message}
                            onChange={event => setMessage(event.target.value)}
                            rows={4}
                            maxLength={2000}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <p className="text-right text-[10px] text-slate-400">{message.length}/2000</p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={async () => {
                            const payload = payloadForRole();
                            if (!payload) { toast.error('Select a recipient'); return; }
                            if (subject.trim().length < 3) { toast.error('Subject required (min 3 chars)'); return; }

                            if (isMarketplaceQuoteRequest && recipientRole === 'seller') {
                                try {
                                    const quotePayload = {
                                        sellerId: Number(counterpartyId),
                                        subject: subject.trim(),
                                        message: message.trim(),
                                        estimatedValue: initialPrice ? Number(initialPrice) : undefined
                                    };
                                    const createdQuote = await runWithToast(() => postApi<any>('/api/quote-requests', quotePayload), {
                                        loading: 'Submitting formal quote request...',
                                        success: 'Quote request sent to seller',
                                        error: err => err instanceof Error ? err.message : 'Unable to send quote request'
                                    });

                                    const updatedList = await queryClient.fetchQuery({
                                        queryKey: ['conversations', 'list'],
                                        queryFn: fetchConversations
                                    });
                                    const matched = updatedList?.find(c =>
                                        (c.sellerId === Number(counterpartyId) || c.buyerId === Number(counterpartyId)) &&
                                        (c.subject?.includes(String(createdQuote?.id)) || c.subject?.includes(subject.trim()))
                                    ) || updatedList?.[0];

                                    if (matched?.id) {
                                        onCreated(matched.id, matched);
                                        return;
                                    }
                                } catch {
                                    // Fallback to standard conversation creation
                                }
                            }

                            try {
                                const result = await runWithToast(() => mut.mutateAsync(payload), {
                                    loading: isMarketplaceQuoteRequest ? 'Sending quote request...' : 'Starting conversation...',
                                    success: isMarketplaceQuoteRequest ? 'Quote request sent' : 'Conversation started',
                                    error: err => err instanceof Error ? err.message : 'Unable to create conversation'
                                });
                                if (result?.conversation?.id) onCreated(result.conversation.id, result.conversation);
                            } catch {
                                // Handled
                            }
                        }}
                        disabled={mut.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                        {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        {isMarketplaceQuoteRequest ? 'Send Quote Request' : 'Start Chat'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
