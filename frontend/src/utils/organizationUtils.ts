import type { OrgStatus } from '../hooks/useOrgRole';
import { cleanDeliveryAddress } from '../features/shared/format';

/**
 * Resolves the official display organization name from the user session and org status.
 * Evaluates verified organization records, buyer/seller profiles, and registration metadata.
 */
export function getResolvedOrgName(user: any, orgStatus?: OrgStatus | null): string {
  if (!user && !orgStatus) return '';
  const reg = ((user?.registrationDetails) || {}) as Record<string, any>;
  const raw = (
    orgStatus?.organization?.organizationName ||
    user?.organization?.organizationName ||
    user?.buyerProfile?.organizationName ||
    user?.sellerProfile?.businessName ||
    user?.sellerProfile?.companyName ||
    user?.sellerProfile?.nameAsInPan ||
    user?.buyerProfile?.departmentName ||
    user?.buyerProfile?.entityName ||
    user?.buyerProfile?.companyName ||
    user?.shgProfile?.groupName ||
    user?.shgProfile?.shgName ||
    reg.organizationName ||
    reg.businessName ||
    reg.companyName ||
    reg.organisation ||
    reg.enterpriseName ||
    reg.legalName ||
    reg.tradeName ||
    ''
  );

  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}

export interface ResolvedAddressInfo {
  address: string;
  source: 'gst' | 'onboarding' | 'organization' | 'none';
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

/**
 * Resolves the authentic delivery address from onboarding (buyer profile), GST verification,
 * or linked organization details.
 */
export function getResolvedBuyerAddressInfo(user: any, orgStatus?: OrgStatus | null): ResolvedAddressInfo {
  if (!user && !orgStatus) return { address: '', source: 'none' };

  const bp = (user?.buyerProfile || {}) as Record<string, any>;
  const org = (orgStatus?.organization || user?.organization || {}) as Record<string, any>;
  const reg = ((user?.registrationDetails) || {}) as Record<string, any>;
  const gst = ((reg.gstDetails) || {}) as Record<string, any>;

  // 1. Check GST verification address
  const gstStreet = String(gst.address || gst.registeredAddress || gst.principalPlaceOfBusiness || '').trim();
  const gstCity = String(gst.city || '').trim();
  const gstDistrict = String(gst.district || '').trim();
  const gstState = String(gst.state || '').trim();
  const gstPincode = String(gst.pincode || '').trim();

  // 2. Check Onboarding Buyer Profile address
  const bpStreet = String(bp.registeredAddress || bp.corporateAddress || bp.address || '').trim();
  const bpCity = String(bp.city || '').trim();
  const bpDistrict = String(bp.district || '').trim();
  const bpState = String(bp.state || '').trim();
  const bpPincode = String(bp.pincode || '').trim();

  // 3. Check Organization address
  const orgStreetParts = [org.addressLine1, org.addressLine2].filter(Boolean).map((s: any) => String(s).trim()).filter(Boolean);
  const orgStreet = orgStreetParts.join(', ');
  const orgCity = String(org.city || '').trim();
  const orgDistrict = String(org.district || '').trim();
  const orgState = String(org.state || '').trim();
  const orgPincode = String(org.pincode || '').trim();

  // 4. Check Registration Details fallback
  const regStreet = String(reg.registeredAddress || reg.address || '').trim();
  const regCity = String(reg.city || '').trim();
  const regDistrict = String(reg.district || '').trim();
  const regState = String(reg.state || '').trim();
  const regPincode = String(reg.pincode || '').trim();

  let selectedStreet = '';
  let selectedCity = '';
  let selectedDistrict = '';
  let selectedState = '';
  let selectedPincode = '';
  let source: 'gst' | 'onboarding' | 'organization' | 'none' = 'none';

  if (bpStreet) {
    selectedStreet = bpStreet;
    selectedCity = bpCity || gstCity || orgCity || regCity;
    selectedDistrict = bpDistrict || gstDistrict || orgDistrict || regDistrict;
    selectedState = bpState || gstState || orgState || regState;
    selectedPincode = bpPincode || gstPincode || orgPincode || regPincode;
    source = gstStreet && bpStreet.toLowerCase().includes(gstStreet.toLowerCase().slice(0, 15)) ? 'gst' : 'onboarding';
  } else if (gstStreet) {
    selectedStreet = gstStreet;
    selectedCity = gstCity || bpCity || orgCity || regCity;
    selectedDistrict = gstDistrict || bpDistrict || orgDistrict || regDistrict;
    selectedState = gstState || bpState || orgState || regState;
    selectedPincode = gstPincode || bpPincode || orgPincode || regPincode;
    source = 'gst';
  } else if (orgStreet) {
    selectedStreet = orgStreet;
    selectedCity = orgCity || bpCity || gstCity || regCity;
    selectedDistrict = orgDistrict || bpDistrict || gstDistrict || regDistrict;
    selectedState = orgState || bpState || gstState || regState;
    selectedPincode = orgPincode || bpPincode || gstPincode || regPincode;
    source = 'organization';
  } else if (regStreet) {
    selectedStreet = regStreet;
    selectedCity = regCity;
    selectedDistrict = regDistrict;
    selectedState = regState;
    selectedPincode = regPincode;
    source = 'onboarding';
  }

  if (!selectedStreet) {
    return { address: '', source: 'none' };
  }

  // Deduplicate city & district if same or sub-string
  const city = selectedCity;
  const dist = selectedDistrict;
  const isCitySameDist = city && dist && (
    city.toLowerCase() === dist.toLowerCase() ||
    (city.length >= 5 && dist.length >= 5 && (
      city.toLowerCase().startsWith(dist.toLowerCase().slice(0, 5)) ||
      dist.toLowerCase().startsWith(city.toLowerCase().slice(0, 5))
    ))
  );

  const locParts = [
    isCitySameDist ? (dist.length >= city.length ? dist : city) : [city, dist].filter(Boolean).join(', '),
    selectedState,
  ].filter(Boolean).join(', ');
  const pin = selectedPincode ? ` - ${selectedPincode}` : '';

  const raw = `${selectedStreet}${selectedStreet && locParts ? ', ' : ''}${locParts}${pin}`;
  const cleaned = cleanDeliveryAddress(raw) || raw;

  return {
    address: cleaned,
    source,
    street: selectedStreet,
    city: selectedCity,
    district: selectedDistrict,
    state: selectedState,
    pincode: selectedPincode
  };
}

/**
 * Returns the fully resolved delivery address string from authentic onboarding or GST records.
 */
export function getResolvedBuyerAddress(user: any, orgStatus?: OrgStatus | null): string {
  return getResolvedBuyerAddressInfo(user, orgStatus).address;
}

