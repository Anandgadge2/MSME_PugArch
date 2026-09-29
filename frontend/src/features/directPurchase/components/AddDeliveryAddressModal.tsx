import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { FocusTrap } from '../../../components/ui/FocusTrap';
import { STATE_OPTIONS, getDistrictOptions } from '../../../data/indianLocations';
import { createDeliveryAddress, type DeliveryAddressDto } from '../api';
import { useAuth } from '../../../hooks/useAuth';
import { useOrgRole } from '../../../hooks/useOrgRole';
import { getResolvedBuyerAddressInfo, getResolvedOrgName } from '../../../utils/organizationUtils';

export interface AddDeliveryAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddressCreated: (address: DeliveryAddressDto) => void;
  hasExistingAddresses?: boolean;
}

export function AddDeliveryAddressModal({
  isOpen,
  onClose,
  onAddressCreated,
  hasExistingAddresses = false
}: AddDeliveryAddressModalProps) {
  const { user } = useAuth();
  const { orgStatus } = useOrgRole();

  const [addressLabel, setAddressLabel] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [addressType, setAddressType] = useState('OFFICE');
  const [contactPersonName, setContactPersonName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [alternateMobileNumber, setAlternateMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [gstState, setGstState] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedAddressInfo = React.useMemo(() => getResolvedBuyerAddressInfo(user, orgStatus), [user, orgStatus]);
  const resolvedOrgName = React.useMemo(() => getResolvedOrgName(user, orgStatus), [user, orgStatus]);

  // Initialize defaults from session / profile when modal opens
  useEffect(() => {
    if (isOpen) {
      if (!organizationName && resolvedOrgName) {
        setOrganizationName(resolvedOrgName);
      }
      if (!contactPersonName && user?.name) {
        setContactPersonName(user.name);
      }
      if (!mobileNumber && (user?.mobile || (user as any)?.phone)) {
        setMobileNumber(String(user?.mobile || (user as any)?.phone).replace(/\D/g, ''));
      }
      if (!email && user?.email) {
        setEmail(user.email);
      }
      if (!addressLabel) {
        setAddressLabel('Primary Delivery Location');
      }
    }
  }, [isOpen, resolvedOrgName, user]);

  if (!isOpen || typeof window === 'undefined') return null;

  const handleStateChange = (val: string) => {
    setState(val);
    const districts = getDistrictOptions(val);
    if (!districts.some(d => d.value === district)) {
      setDistrict('');
    }
  };

  const handleFillFromProfile = () => {
    if (resolvedAddressInfo && resolvedAddressInfo.source !== 'none') {
      setAddressLabel(prev => prev || 'Registered Office Address');
      if (resolvedOrgName) setOrganizationName(resolvedOrgName);
      if (user?.name) setContactPersonName(user.name);
      if (user?.mobile || (user as any)?.phone) setMobileNumber(String(user?.mobile || (user as any)?.phone).replace(/\D/g, ''));
      if (user?.email) setEmail(user.email);
      setAddressLine1(resolvedAddressInfo.street || '');
      setCity(resolvedAddressInfo.city || '');
      setDistrict(resolvedAddressInfo.district || '');
      setState(resolvedAddressInfo.state || '');
      setPincode(resolvedAddressInfo.pincode || '');
      toast.info('Address fields pre-filled from verified onboarding details');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressLabel.trim() || !contactPersonName.trim() || !mobileNumber.trim() || !addressLine1.trim() || !state || !district || !city.trim() || !pincode.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const newAddr = await createDeliveryAddress({
        addressLabel: addressLabel.trim(),
        organizationName: organizationName.trim() || null,
        contactPersonName: contactPersonName.trim(),
        mobileNumber: mobileNumber.trim(),
        alternateMobileNumber: alternateMobileNumber.trim() || null,
        email: email.trim() || null,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || null,
        city: city.trim(),
        district: district.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        landmark: landmark.trim() || null,
        gstState: gstState.trim() || null,
        placeOfSupply: placeOfSupply.trim() || null,
        addressType,
        isDefault: !hasExistingAddresses
      });

      toast.success('New delivery address added successfully.');
      onAddressCreated(newAddr);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add delivery address.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-delivery-address-title"
      onWheel={e => e.stopPropagation()}
    >
      <FocusTrap onEscape={onClose} className="w-full max-w-2xl">
        <div className="relative w-full max-w-2xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <h2 id="add-delivery-address-title" className="text-lg font-bold text-[#12335f]">
                Add New Delivery Address
              </h2>
              {resolvedAddressInfo && resolvedAddressInfo.source !== 'none' && (
                <button
                  type="button"
                  onClick={handleFillFromProfile}
                  className="text-xs text-[#12335f] hover:underline font-bold mt-1 inline-flex items-center gap-1 cursor-pointer"
                >
                  Auto-fill from verified onboarding / GST details
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close address dialog"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="modal-address-label" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Address Label <span className="text-rose-600">*</span>
                </label>
                <Input
                  id="modal-address-label"
                  required
                  placeholder="e.g. Headquarters, Warehouse A"
                  value={addressLabel}
                  onChange={e => setAddressLabel(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-org-name" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Organisation Name
                </label>
                <Input
                  id="modal-org-name"
                  placeholder="Company / Department Name"
                  value={organizationName}
                  onChange={e => setOrganizationName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-address-type" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Address Type <span className="text-rose-600">*</span>
                </label>
                <select
                  id="modal-address-type"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                  value={['OFFICE', 'WAREHOUSE', 'PROJECT_SITE', 'FACTORY'].includes(addressType) ? addressType : 'OTHER'}
                  onChange={e => setAddressType(e.target.value)}
                >
                  <option value="OFFICE">Office</option>
                  <option value="WAREHOUSE">Warehouse</option>
                  <option value="PROJECT_SITE">Project Site</option>
                  <option value="FACTORY">Factory</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {!['OFFICE', 'WAREHOUSE', 'PROJECT_SITE', 'FACTORY'].includes(addressType) && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                  <label htmlFor="modal-specify-type" className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Specify Address Type <span className="text-rose-600">*</span>
                  </label>
                  <Input
                    id="modal-specify-type"
                    required
                    placeholder="e.g. Temporary, SHG Center, Hub"
                    value={addressType === 'OTHER' ? '' : addressType}
                    onChange={e => setAddressType(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="modal-contact-person" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Contact Person Name <span className="text-rose-600">*</span>
                </label>
                <Input
                  id="modal-contact-person"
                  required
                  placeholder="Receiver Name"
                  value={contactPersonName}
                  onChange={e => setContactPersonName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-mobile" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Mobile Number <span className="text-rose-600">*</span>
                </label>
                <Input
                  id="modal-mobile"
                  required
                  type="tel"
                  pattern="[0-9]{10,15}"
                  minLength={10}
                  maxLength={15}
                  title="Mobile number must be between 10 and 15 digits"
                  placeholder="10-digit Mobile Number"
                  value={mobileNumber}
                  onChange={e => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-alt-mobile" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Alternate Mobile
                </label>
                <Input
                  id="modal-alt-mobile"
                  type="tel"
                  pattern="[0-9]{10,15}"
                  maxLength={15}
                  title="Alternate mobile number must be between 10 and 15 digits"
                  placeholder="Optional Mobile"
                  value={alternateMobileNumber}
                  onChange={e => setAlternateMobileNumber(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-email" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Email Address
                </label>
                <Input
                  id="modal-email"
                  type="email"
                  placeholder="Receiver Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-address-line1" className="text-xs font-black uppercase tracking-wider text-slate-700">
                Address Line 1 <span className="text-rose-600">*</span>
              </label>
              <Input
                id="modal-address-line1"
                required
                placeholder="Building/Flat/Plot Number, Street Name"
                value={addressLine1}
                onChange={e => setAddressLine1(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-address-line2" className="text-xs font-black uppercase tracking-wider text-slate-700">
                Address Line 2
              </label>
              <Input
                id="modal-address-line2"
                placeholder="Locality, Sector, Area (Optional)"
                value={addressLine2}
                onChange={e => setAddressLine2(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="modal-state" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  State <span className="text-rose-600">*</span>
                </label>
                <select
                  id="modal-state"
                  required
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                  value={state}
                  onChange={e => handleStateChange(e.target.value)}
                >
                  <option value="">Select State</option>
                  {STATE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-district" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  District <span className="text-rose-600">*</span>
                </label>
                <select
                  id="modal-district"
                  required
                  disabled={!state}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                >
                  <option value="">Select District</option>
                  {getDistrictOptions(state).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-city" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  City <span className="text-rose-600">*</span>
                </label>
                <Input
                  id="modal-city"
                  required
                  placeholder="Enter city / town / village"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-pincode" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Pincode <span className="text-rose-600">*</span>
                </label>
                <Input
                  id="modal-pincode"
                  required
                  pattern="[0-9]{6,10}"
                  minLength={6}
                  maxLength={10}
                  title="Pincode must be between 6 and 10 digits"
                  placeholder="6 digits"
                  value={pincode}
                  onChange={e => setPincode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="modal-landmark" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Landmark
                </label>
                <Input
                  id="modal-landmark"
                  placeholder="Nearby popular spot"
                  value={landmark}
                  onChange={e => setLandmark(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-gst-state" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  GST State Code
                </label>
                <Input
                  id="modal-gst-state"
                  placeholder="e.g. 27-Maharashtra"
                  value={gstState}
                  onChange={e => setGstState(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-place-of-supply" className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Place of Supply
                </label>
                <Input
                  id="modal-place-of-supply"
                  placeholder="e.g. Maharashtra"
                  value={placeOfSupply}
                  onChange={e => setPlaceOfSupply(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 text-xs font-bold border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 text-xs font-bold bg-[#12335f] hover:bg-[#12335f]/90 text-white cursor-pointer"
              >
                {isSubmitting ? 'Saving Address...' : 'Save Address'}
              </Button>
            </div>
          </form>
        </div>
      </FocusTrap>
    </div>,
    document.body
  );
}
