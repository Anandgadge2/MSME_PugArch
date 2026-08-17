import React, { memo } from 'react';
import { KpiCard, type KpiCardProps, type KpiCardTone } from './KpiCard';

export type KpiTone = KpiCardTone;
export interface KpiTileProps extends KpiCardProps {}

export const KpiTile = memo(function KpiTile(props: KpiTileProps) {
  return <KpiCard {...props} />;
});

export default KpiTile;
