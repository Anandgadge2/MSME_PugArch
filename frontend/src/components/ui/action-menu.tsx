import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVertical, Eye, Edit3, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ActionMenuProps {
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleteDisabled?: boolean;
}

export function ActionMenu({
  onView,
  onEdit,
  onDelete,
  isDeleteDisabled
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    
    let upward = false;
    // If not enough space below, and more space above, open upwards
    if (spaceBelow < menuRect.height + 8 && spaceAbove > menuRect.height) {
      upward = true;
    }

    let leftPos = triggerRect.right - menuRect.width;
    // Keep within right edge
    if (leftPos < 8) leftPos = 8;
    // Keep within left edge
    if (leftPos + menuRect.width > window.innerWidth - 8) {
      leftPos = window.innerWidth - menuRect.width - 8;
    }

    setStyle({
      position: 'fixed',
      left: leftPos,
      top: upward ? triggerRect.top - menuRect.height - 4 : triggerRect.bottom + 4,
      zIndex: 99999, // Ensure it's above other fixed elements
      visibility: 'visible',
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      // Listen to scroll and resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      // Small delay to reposition in case of layout shifts
      setTimeout(updatePosition, 10);
    } else {
      setStyle({ visibility: 'hidden' });
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const closeAndCall = (fn?: () => void) => {
    setIsOpen(false);
    if (fn) fn();
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={cn(
          "flex items-center justify-center h-8 w-8 p-0 rounded-lg border transition-colors outline-none",
          isOpen ? "bg-slate-100 text-slate-900 border-slate-300 shadow-inner" : "border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 bg-white shadow-sm hover:shadow"
        )}
        onClick={(e) => { 
          e.preventDefault();
          e.stopPropagation(); 
          setIsOpen(!isOpen); 
        }}
        aria-label="Actions"
        title="Actions"
      >
        <EllipsisVertical className="h-5 w-5 text-slate-600 shrink-0" strokeWidth={2} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={style}
          className="flex flex-col min-w-[140px] bg-white border border-slate-200 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => closeAndCall(onView)}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Eye className="h-4 w-4 text-slate-400" /> View
          </button>
          
          {onEdit && (
            <button
              onClick={() => closeAndCall(onEdit)}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Edit3 className="h-4 w-4 text-blue-500" /> Edit
            </button>
          )}
          
          {onDelete && (
            <>
              <div className="h-px bg-slate-100 my-1 mx-2" />
              <button
                disabled={isDeleteDisabled}
                onClick={() => closeAndCall(onDelete)}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="h-4 w-4 text-rose-500" /> Delete
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
