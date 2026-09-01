'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Smile, Heart, ThumbsUp, Sparkles, Coffee, Flag, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

const EMOJI_CATEGORIES: Record<string, { label: string; emojis: string[] }> = {
  smileys: {
    label: 'Smileys & Emotion',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
      '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖',
      '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
      '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
      '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦'
    ]
  },
  gestures: {
    label: 'People & Hands',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪',
      '🙏', '🤝', '👏', '🙌', '👐', '🤲', '✍️', '💅', '🤳', '🙋‍♂️',
      '🙋‍♀️', '🙇‍♂️', '🙇‍♀️', '🤦‍♂️', '🤦‍♀️', '🤷‍♂️', '🤷‍♀️', '👨‍💼', '👩‍💼', '🧑‍💻'
    ]
  },
  objects: {
    label: 'Work & Commerce',
    emojis: [
      '💼', '📦', '🚚', '🚢', '✈️', '📋', '📄', '📑', '📊', '📈',
      '📉', '🏷️', '💰', '💵', '💳', '🧾', '✉️', '📧', '📥', '📤',
      '📞', '📱', '💻', '🖥️', '🖨️', '📁', '📂', '🔒', '🔑', '🛠️',
      '⚙️', '🏗️', '🏭', '🏢', '🏪', '🏭', '🏛️', '🛡️', '✅', '❌'
    ]
  },
  symbols: {
    label: 'Symbols & Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '✨', '⭐',
      '🌟', '💫', '🔥', '💥', '💯', '🔔', '🔕', '⚠️', '❗', '❓',
      '➕', '➖', '✖️', '➗', '💲', '🇮🇳', '🌐', '🚀', '🎯', '🏆'
    ]
  }
};

interface EmojiPickerPopoverProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPickerPopover({ onSelectEmoji, onClose }: EmojiPickerPopoverProps) {
  const [activeCategory, setActiveCategory] = useState<string>('smileys');
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  const allFilteredEmojis = search.trim()
    ? Object.values(EMOJI_CATEGORIES).flatMap(c => c.emojis)
    : EMOJI_CATEGORIES[activeCategory]?.emojis || [];

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-14 left-0 z-50 flex h-72 w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header Search & Close */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search emojis..."
            className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs outline-none focus:border-emerald-500"
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category Tabs */}
      {!search.trim() && (
        <div className="flex border-b border-slate-100 bg-white px-2">
          {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={cn(
                'flex flex-1 items-center justify-center py-2 text-[10px] font-bold transition border-b-2',
                activeCategory === key
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              )}
            >
              {key === 'smileys' && <Smile className="h-4 w-4" />}
              {key === 'gestures' && <ThumbsUp className="h-4 w-4" />}
              {key === 'objects' && <Coffee className="h-4 w-4" />}
              {key === 'symbols' && <Heart className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-7 gap-1">
          {allFilteredEmojis.map((emoji, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                onSelectEmoji(emoji);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-slate-100 active:scale-90 transition"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
