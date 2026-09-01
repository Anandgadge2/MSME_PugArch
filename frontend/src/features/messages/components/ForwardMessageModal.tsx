'use client';

import { useState } from 'react';
import { Search, Send, X, Forward, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConversations, useSendMessage } from '../hooks';
import type { MessageDto, ConversationDto } from '../api';
import { Button } from '../../../components/ui/button';
import { roleLabel } from '../pages/MessagesPage';

interface ForwardMessageModalProps {
  message: MessageDto;
  currentUserId: number;
  onClose: () => void;
  onForwarded?: (targetConversationId: number) => void;
}

export default function ForwardMessageModal({
  message,
  currentUserId,
  onClose,
  onForwarded
}: ForwardMessageModalProps) {
  const [search, setSearch] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [forwarding, setForwarding] = useState(false);

  const { data: conversations = [], isLoading } = useConversations();
  const sendMut = useSendMessage();

  const filtered = conversations.filter(c => {
    const counterpart = c.buyerId === currentUserId ? c.seller : c.buyer;
    const term = search.toLowerCase().trim();
    if (!term) return true;
    const haystack = `${c.subject} ${counterpart?.name || ''} ${counterpart?.role || ''}`.toLowerCase();
    return haystack.includes(term);
  });

  const handleForward = async () => {
    if (!selectedConvId) {
      toast.error('Please select a conversation to forward to.');
      return;
    }
    setForwarding(true);
    try {
      const fileAssetIds = (message.attachments || [])
        .map(a => a.fileAssetId)
        .filter(id => Number.isFinite(id) && id > 0);

      const content = message.content ? `[Forwarded]: ${message.content}` : '[Forwarded attachment]';

      await sendMut.mutateAsync({
        id: selectedConvId,
        data: {
          content,
          fileAssetIds
        }
      });

      toast.success('Message forwarded successfully!');
      if (onForwarded) onForwarded(selectedConvId);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to forward message');
    } finally {
      setForwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#12335f] px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <Forward className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-black uppercase tracking-wider">Forward Message</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/80 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Message Preview */}
        <div className="border-b border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Message Preview</p>
          <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-700">
            {message.content || `${message.attachments?.length || 0} attachment(s)`}
          </p>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search chat or contact..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
            />
          </div>
        </div>

        {/* List of Conversations */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-3 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading chats...
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs font-semibold text-slate-400">No chats found.</p>
          ) : (
            filtered.map(c => {
              const counterpart = c.buyerId === currentUserId ? c.seller : c.buyer;
              const isSelected = selectedConvId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedConvId(c.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50 ${
                    isSelected ? 'border-2 border-emerald-500 bg-emerald-50/60' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-black text-slate-900">{counterpart?.name || 'User'}</span>
                      {counterpart?.role && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600">
                          {counterpart.role}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{c.subject}</p>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
          <Button variant="outline" onClick={onClose} disabled={forwarding}>
            Cancel
          </Button>
          <Button
            onClick={handleForward}
            disabled={!selectedConvId || forwarding}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {forwarding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Forward Now
          </Button>
        </div>
      </div>
    </div>
  );
}
