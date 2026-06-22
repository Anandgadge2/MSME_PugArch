import type { BidType, PacketType } from '../types/steps';
import { STEP_CONFIG_BY_BID_TYPE } from '../utils/bidTypeConfig';

export const useFieldDependencies = (bidType: BidType | null, packetType: PacketType) => ({
  step4Sections: bidType ? STEP_CONFIG_BY_BID_TYPE[bidType] : [],
  showTechnicalPacket: packetType === 'TWO_PACKET',
  showFinancialPacket: packetType === 'TWO_PACKET',
  isPac: bidType === 'PAC_BID',
  isReverseAuction: bidType === 'REVERSE_AUCTION' || bidType === 'BID_WITH_RA',
});
