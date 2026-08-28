'use client';

/**
 * DirectCheckoutPage — Streamlined Direct Purchase Checkout Page.
 *
 * Route: /buyer/checkout (or /direct-purchase/checkout)
 * Flow: Cart → Direct Checkout (Delivery, Billing, Order Details, Auto Totals) → Place Order → Order Created (PO Issued to Seller)
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  MapPin,
  MapPinOff,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from '@/components/ui/loader';
import { CheckoutSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useActiveCart, useRemoveCartItem, useUpdateCartItem } from '@/features/cart/hooks';
import { fetchDeliveryAddresses, placeDirectOrder, type DeliveryAddressDto } from '../api';
import { EmptyState, LoadingState } from '@/features/shared/FeatureStates';
import { formatCurrency } from '@/features/shared/format';
import { api } from '@/lib/api';

export default function DirectCheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const activeCartQuery = useActiveCart();
  const cart = activeCartQuery.data;
  const updateQtyMut = useUpdateCartItem();
  const removeMut = useRemoveCartItem();

  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddressDto[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [isCustomAddress, setIsCustomAddress] = useState(false);

  // Delivery details form state
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [contactName, setContactName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  // Billing details form state
  const [sameAsDelivery, setSameAsDelivery] = useState(true);
  const [billingAddress, setBillingAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');

  // Order & Payment details
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PAY_ON_INVOICE' | 'NET_30' | 'PAY_ON_DELIVERY' | 'BANK_TRANSFER' | 'ONLINE'>('PAY_ON_INVOICE');

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Auto-fill user profile & saved delivery address
  useEffect(() => {
    if (!user) return;
    let alive = true;

    const prefillUser = async () => {
      try {
        const meRes = await api.fetch('/api/auth/me', { skipCache: true });
        if (meRes.ok && alive) {
          const data = await meRes.json();
          const profile = data.profile || data.user?.buyerProfile || {};
          const org = data.user?.organization || {};

          setContactName(prev => prev || user.name || profile.representativeName || '');
          setMobileNumber(prev => prev || user.mobile || profile.mobile || '');
          setCompanyName(prev => prev || profile.organizationName || org.organizationName || org.name || '');
          setGstin(prev => prev || profile.gstin || org.gstin || '');
        }
      } catch (err) {
        console.error('Failed to prefill user info', err);
      }

      try {
        const addresses = await fetchDeliveryAddresses();
        if (alive && Array.isArray(addresses) && addresses.length > 0) {
          setSavedAddresses(addresses);
          const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
          if (defaultAddr) {
            applyAddress(defaultAddr);
          }
        }
      } catch {
        // address fetch error silent fallback
      }
    };

    prefillUser();
    return () => { alive = false; };
  }, [user]);

  const applyAddress = (addr: DeliveryAddressDto) => {
    setSelectedAddressId(addr.id);
    setIsCustomAddress(false);
    const line = [addr.addressLine1, addr.addressLine2, addr.landmark].filter(Boolean).join(', ');
    setDeliveryAddress(line);
    setCity(addr.city || '');
    setState(addr.state || '');
    setPincode(addr.pincode || '');
    if (addr.contactPersonName) setContactName(addr.contactPersonName);
    if (addr.mobileNumber) setMobileNumber(addr.mobileNumber);
  };

  // Automatic System Calculations
  const calculations = useMemo(() => {
    if (!cart || !cart.items || cart.items.length === 0) {
      return { subtotal: 0, totalGst: 0, deliveryCharge: 0, platformFee: 0, grandTotal: 0, itemGroupedBySeller: {} };
    }

    let subtotal = 0;
    let totalGst = 0;
    const sellerSet = new Set<number>();
    const itemGroupedBySeller: Record<number, typeof cart.items> = {};

    cart.items.forEach(it => {
      const qty = Number(it.quantity || 1);
      const price = Number(it.unitPrice || 0);
      const itemSubtotal = qty * price;
      subtotal += itemSubtotal;

      // Estimate GST rate (default 18% if not specified)
      const gstRate = 0.18;
      totalGst += itemSubtotal * gstRate;

      sellerSet.add(it.sellerId);
      if (!itemGroupedBySeller[it.sellerId]) itemGroupedBySeller[it.sellerId] = [];
      itemGroupedBySeller[it.sellerId].push(it);
    });

    // Delivery charge calculation (Free for orders over 10,000 or ₹250 flat)
    const deliveryCharge = subtotal > 10000 ? 0 : sellerSet.size * 250;
    const platformFee = 0; // ₹0 for direct purchase
    const grandTotal = Math.round(subtotal + totalGst + deliveryCharge + platformFee);

    return {
      subtotal,
      totalGst,
      deliveryCharge,
      platformFee,
      grandTotal,
      sellerCount: sellerSet.size,
      itemGroupedBySeller
    };
  }, [cart]);

  if (activeCartQuery.isLoading) {
    return <CheckoutSkeleton />;
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <EmptyState
        title="Your Cart is Empty"
        description="Add products or services from the marketplace to proceed with checkout."
        action={{ label: 'Explore Marketplace', onClick: () => router.push('/buyer/marketplace') }}
      />
    );
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deliveryAddress.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      toast.error('Please complete all required delivery address fields.');
      return;
    }

    if (!contactName.trim() || !mobileNumber.trim()) {
      toast.error('Please enter contact person name and mobile number.');
      return;
    }

    if (!sameAsDelivery && !billingAddress.trim()) {
      toast.error('Please specify billing address or check "Same as delivery address".');
      return;
    }

    setIsPlacingOrder(true);
    try {
      const res = await placeDirectOrder({
        deliveryAddressId: selectedAddressId,
        deliveryAddress: deliveryAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        contactName: contactName.trim(),
        mobileNumber: mobileNumber.trim(),
        sameAsDelivery,
        billingAddress: sameAsDelivery ? undefined : billingAddress.trim(),
        companyName: companyName.trim() || undefined,
        gstin: gstin.trim() || undefined,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        paymentMethod
      });

      const orderCount = res?.orders?.length || 1;
      toast.success(`Order Placed Successfully! ${orderCount} Purchase Order(s) created.`);
      router.push('/orders');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push('/cart')}
            className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Cart
          </button>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-[#12335f]" /> Direct Purchase Checkout
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Complete your delivery & billing details to issue Purchase Orders directly to seller(s).
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold shrink-0">
          <ShieldCheck className="h-4 w-4" /> Direct Purchase Mode Active
        </div>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form Fields (8 Cols) */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">

          {/* Section 1: Delivery Details */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3 pt-4">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-[#12335f] flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#12335f]" /> 1. Delivery Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Saved Address Selector */}
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Select Saved Delivery Address
                  </label>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {savedAddresses.map(addr => {
                      const isSelected = selectedAddressId === addr.id && !isCustomAddress;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => applyAddress(addr)}
                          className={`cursor-pointer rounded-xl border p-3 transition-all ${
                            isSelected
                              ? 'border-[#12335f] bg-blue-50/40 ring-2 ring-[#12335f]/20'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">{addr.addressLabel}</span>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-[#12335f]" />}
                          </div>
                          <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {addr.addressLine1}, {addr.city}, {addr.state} - {addr.pincode}
                          </p>
                          <p className="mt-1 text-[11px] font-medium text-slate-500">
                            Contact: {addr.contactPersonName} ({addr.mobileNumber})
                          </p>
                        </div>
                      );
                    })}

                    <div
                      onClick={() => {
                        setSelectedAddressId(null);
                        setIsCustomAddress(true);
                        setDeliveryAddress('');
                        setCity('');
                        setState('');
                        setPincode('');
                      }}
                      className={`cursor-pointer rounded-xl border border-dashed p-3 transition-all flex items-center justify-center text-center ${
                        isCustomAddress
                          ? 'border-[#12335f] bg-blue-50/30'
                          : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/60'
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-700">+ Use Custom Address</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Address Form */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Delivery Address Line *
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="Plot No., Building Name, Street, Area, Landmark"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">City / District *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">State *</label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={e => setState(e.target.value)}
                    placeholder="State"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pincode *</label>
                  <input
                    type="text"
                    required
                    value={pincode}
                    onChange={e => setPincode(e.target.value)}
                    placeholder="6-digit Pincode"
                    maxLength={10}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Contact Person Name *</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="Receiver's Name"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    placeholder="10-digit mobile number for delivery updates"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Billing Details */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3 pt-4">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-[#12335f] flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#12335f]" /> 2. Billing & Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  id="sameAsDelivery"
                  checked={sameAsDelivery}
                  onChange={e => setSameAsDelivery(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#12335f] focus:ring-[#12335f]"
                />
                <label htmlFor="sameAsDelivery" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Billing Address is same as Delivery Address
                </label>
              </div>

              {!sameAsDelivery && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Billing Address *</label>
                  <textarea
                    rows={2}
                    required
                    value={billingAddress}
                    onChange={e => setBillingAddress(e.target.value)}
                    placeholder="Enter complete registered billing address"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Company / Organization Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Organization Name for Invoice & PO"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={e => setGstin(e.target.value.toUpperCase())}
                    placeholder="15-digit GSTIN (e.g. 27AAAAA0000A1Z5)"
                    maxLength={15}
                    className="w-full uppercase rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Order Instructions & Expected Date */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3 pt-4">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-[#12335f] flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#12335f]" /> 3. Delivery Instructions & Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Expected Delivery Date (Optional)
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={expectedDeliveryDate}
                    onChange={e => setExpectedDeliveryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Delivery Instructions for Seller (Optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryInstructions}
                    onChange={e => setDeliveryInstructions(e.target.value)}
                    placeholder="Gate entrance instructions, preferred delivery timing..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Payment Terms */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3 pt-4">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-[#12335f] flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#12335f]" /> 4. Payment Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {[
                { id: 'PAY_ON_INVOICE', label: 'Pay on Invoice / Net 30', desc: 'Seller issues tax invoice upon dispatch, payable within 30 days.' },
                { id: 'PAY_ON_DELIVERY', label: 'Pay on Delivery (POD)', desc: 'Payment made upon successful inspection and receipt of goods.' },
                { id: 'BANK_TRANSFER', label: 'Direct Bank Transfer (NEFT / RTGS)', desc: 'Direct bank settlement upon order confirmation.' },
                { id: 'ONLINE', label: 'Online Payment Gateway', desc: 'Pay via Card, UPI, or Net Banking.' },
              ].map(opt => (
                <div
                  key={opt.id}
                  onClick={() => setPaymentMethod(opt.id as any)}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all flex items-start gap-3 ${
                    paymentMethod === opt.id
                      ? 'border-[#12335f] bg-blue-50/40 ring-2 ring-[#12335f]/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === opt.id}
                    onChange={() => {}}
                    className="mt-0.5 h-4 w-4 text-[#12335f] focus:ring-[#12335f]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{opt.label}</p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Order Summary & Place Order (4-5 Cols) */}
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          <Card className="border-slate-200/80 shadow-md sticky top-6">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] text-white py-4 rounded-t-xl">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-xs font-semibold opacity-80">{cart.items.length} Item(s)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Items List Preview */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1 divide-y divide-slate-100">
                {cart.items.map(it => {
                  const qty = Number(it.quantity);
                  const price = Number(it.unitPrice);
                  const lineTotal = qty * price;
                  return (
                    <div key={it.id} className="pt-2.5 first:pt-0 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{it.itemName}</p>
                        <p className="text-[10px] text-slate-500">
                          {qty} {it.unitOfMeasure} × {formatCurrency(price)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-slate-900 shrink-0">
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Product Subtotal</span>
                  <span className="font-mono font-semibold">{formatCurrency(calculations.subtotal)}</span>
                </div>

                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Estimated GST / Tax</span>
                  <span className="font-mono font-semibold">{formatCurrency(calculations.totalGst)}</span>
                </div>

                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Delivery Charges</span>
                  <span className="font-mono font-semibold">
                    {calculations.deliveryCharge === 0 ? (
                      <span className="text-emerald-700 font-bold uppercase text-[10px]">FREE</span>
                    ) : (
                      formatCurrency(calculations.deliveryCharge)
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Platform Fee</span>
                  <span className="font-mono font-semibold text-emerald-700 font-bold text-[10px] uppercase">₹0 (Waived)</span>
                </div>

                <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase">Grand Total</p>
                    <p className="text-[10px] font-semibold text-slate-500">Inclusive of all taxes</p>
                  </div>
                  <span className="text-lg font-black text-[#12335f]">
                    {formatCurrency(calculations.grandTotal)}
                  </span>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-[11px] font-medium text-slate-700 space-y-1">
                <p className="font-bold text-[#12335f] flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" /> Seller Confirmation Flow
                </p>
                <p className="text-slate-600 leading-snug">
                  Clicking <strong>Place Order</strong> issues Purchase Orders directly to {calculations.sellerCount} seller(s). Sellers will confirm order acceptance before dispatch.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isPlacingOrder}
                className="w-full h-12 bg-[#12335f] hover:bg-[#0e2a4f] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all"
              >
                {isPlacingOrder ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Placing Order...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" /> Place Order ({formatCurrency(calculations.grandTotal)})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
