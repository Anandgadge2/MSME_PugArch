import React from 'react';
import type { PacketType } from '../../types/steps';

export default function PacketTypeBadge({ packetType }: { packetType: PacketType }) {
  return (
    <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-black text-blue-800">
      {packetType === 'TWO_PACKET' ? 'Two Packet' : 'Single Packet'}
    </span>
  );
}
