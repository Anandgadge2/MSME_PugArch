import React from 'react';
import FormField from '../common/FormField';
import SearchableSelect from '../common/SearchableSelect';
import { BID_CREATION_MODE_OPTIONS, BID_TYPE_OPTIONS, PACKET_TYPE_OPTIONS, PROCUREMENT_METHOD_OPTIONS, YES_NO_OPTIONS } from '../../utils/constants';
import type { StepComponentProps } from '../../types/steps';

export default function Step1_BidTypeSelection({ data, errors, updateField }: StepComponentProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label="Bid Type" required error={errors.bidType}><SearchableSelect value={data.bidType} options={BID_TYPE_OPTIONS} onChange={value => updateField('bidType', value)} allowOther={false} /></FormField>
      <FormField label="Procurement Method" required error={errors.procurementMethod}><SearchableSelect value={data.procurementMethod} options={PROCUREMENT_METHOD_OPTIONS} onChange={value => updateField('procurementMethod', value)} allowOther={false} /></FormField>
      <FormField label="Packet Type" required error={errors.packetType}><SearchableSelect value={data.packetType} options={PACKET_TYPE_OPTIONS} onChange={value => updateField('packetType', value)} allowOther={false} /></FormField>
      <FormField label="Bid Creation Mode" required error={errors.bidCreationMode}><SearchableSelect value={data.bidCreationMode} options={BID_CREATION_MODE_OPTIONS} onChange={value => updateField('bidCreationMode', value)} allowOther={false} /></FormField>
      <FormField label="Reverse Auction Required" required><SearchableSelect value={String(Boolean(data.isReverseAuctionRequired))} options={YES_NO_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))} onChange={value => updateField('isReverseAuctionRequired', value === 'true')} allowOther={false} /></FormField>
      <FormField label="PAC Required" required><SearchableSelect value={String(Boolean(data.isPacRequired))} options={YES_NO_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))} onChange={value => updateField('isPacRequired', value === 'true')} allowOther={false} /></FormField>
    </div>
  );
}
