'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Minus, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { formatCurrency } from '../../../shared/format';
import type { CartDto, CartItemDto } from '../../../cart/api';
import { DataTable, ColumnDef } from '../../../../components/ui/data-table';

export default function Step1_CartReview({
  cart,
  onUpdateQty,
  onRemove,
  isUpdating,
}: {
  cart: CartDto;
  onUpdateQty: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
  isUpdating?: boolean;
}) {
  const total = cart.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);
  const sellerCount = new Set(cart.items.map(i => i.sellerId)).size;

  const columns = useMemo<ColumnDef<CartItemDto>[]>(() => [
    {
      key: 'itemName',
      header: 'Item',
      cell: (item) => <span className="font-semibold">{item.itemName}</span>,
    },
    {
      key: 'seller',
      header: 'Seller',
      cell: (item) => <span>{item.seller?.name || `#${item.sellerId}`}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      cell: (item) => (
        cart.status === 'ACTIVE' ? (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={item.id < 0 || Number(item.quantity) <= 1}
              onClick={() => onUpdateQty(item.id, Math.max(1, Number(item.quantity) - 1))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center font-bold">{item.quantity}</span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={item.id < 0}
              onClick={() => onUpdateQty(item.id, Number(item.quantity) + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <span>{item.quantity}</span>
        )
      ),
    },
    {
      key: 'unitPrice',
      header: 'Unit',
      cell: (item) => <span>{formatCurrency(Number(item.unitPrice))}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      cell: (item) => (
        <span className="font-bold">{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (item) => (
        cart.status === 'ACTIVE' ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-600"
            disabled={item.id < 0}
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        ) : null
      ),
    },
  ], [cart.status, onUpdateQty, onRemove]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-slate-950">Step 1 — Cart Review</h2>
      <p className="text-xs text-slate-500">Cart #{cart.id} · {cart.items.length} line(s) · {sellerCount} seller(s)</p>

      <DataTable<CartItemDto>
        data={cart.items}
        columns={columns}
        keyExtractor={(item) => item.id}
        emptyTitle="Cart is empty"
        emptyDescription="No items found in this cart."
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm">
        <span className="font-bold">Estimated total: {formatCurrency(total)}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/buyer/marketplace"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Add Product
          </Link>
          <Link
            href="/marketplace/compare"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Compare sellers
          </Link>
        </div>
      </div>
    </div>
  );
}
