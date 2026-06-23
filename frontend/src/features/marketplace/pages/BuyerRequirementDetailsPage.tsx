import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  DollarSign, 
  Package, 
  FileText, 
  MapPin, 
  Send,
  X
} from 'lucide-react';

// Mock API services (Replace with actual API calls)
const fetchRequirementDetails = async (id: string) => {
  return {
    data: {
      id,
      title: "High-Grade Industrial Steel Pipes",
      description: "Requirement for seamless high-grade industrial steel pipes for infrastructure project. Must meet ISO 9001 standards.",
      category: "Construction Materials",
      quantity: 500,
      unit: "Meters",
      budgetMin: 10000,
      budgetMax: 25000,
      lastDate: "2026-07-15",
      visibility: "PUBLIC",
      status: "OPEN",
      location: "Mumbai, MH",
      responses: [
        {
          id: "resp1",
          sellerOrganization: { organizationName: "SteelCorp India" },
          offeredPrice: 15000,
          offeredQuantity: 500,
          deliveryTimeline: "2 Weeks",
          status: "SUBMITTED",
          message: "We can provide the highest quality pipes with certification."
        },
        {
          id: "resp2",
          sellerOrganization: { organizationName: "MetalWorks Ltd" },
          offeredPrice: 12000,
          offeredQuantity: 400,
          deliveryTimeline: "3 Weeks",
          status: "SUBMITTED",
          message: "Competitive pricing for bulk order."
        }
      ]
    }
  };
};

const submitBid = async (bidData: any) => {
  console.log("Submitting bid:", bidData);
  return { success: true };
};

const BuyerRequirementDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [requirement, setRequirement] = useState<any>(null);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [bidForm, setBidForm] = useState({
    offeredPrice: '',
    offeredQuantity: '',
    deliveryTimeline: '',
    message: ''
  });

  useEffect(() => {
    if (id) {
      fetchRequirementDetails(id).then(res => setRequirement(res.data));
    }
  }, [id]);

  const handleBidSubmit = async () => {
    await submitBid({ ...bidForm, requirementId: id });
    setIsBidModalOpen(false);
    // Refresh data
    fetchRequirementDetails(id!).then(res => setRequirement(res.data));
  };

  if (!requirement) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-slate-500 font-bold">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-[#0b2447]">{requirement.title}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">Category: {requirement.category}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase ${
                requirement.status === 'OPEN' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
                {requirement.status}
              </span>
            </div>

            <hr className="my-6 border-slate-100" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Description</span>
                    <span className="text-sm font-bold text-slate-700 leading-relaxed">{requirement.description}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Quantity</span>
                    <span className="text-sm font-bold text-slate-700">{requirement.quantity} {requirement.unit}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Budget Range</span>
                    <span className="text-sm font-bold text-slate-700">${requirement.budgetMin} - ${requirement.budgetMax}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Deadline</span>
                    <span className="text-sm font-bold text-slate-700">{requirement.lastDate}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Location</span>
                    <span className="text-sm font-bold text-slate-700">{requirement.location}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button 
                onClick={() => navigate(`/marketplace/requirements/edit/${id}`)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-[#0b2447] shadow-sm hover:bg-slate-50 active:scale-95 transition"
              >
                Edit Requirement
              </button>
              <button 
                onClick={() => setIsBidModalOpen(true)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0b2447] px-5 text-xs font-black text-white shadow-sm hover:bg-[#12335f] active:scale-95 transition"
              >
                Submit Bid
              </button>
            </div>
          </div>

          {/* Responses List */}
          <div>
            <h3 className="text-lg font-black text-[#0b2447] mb-4">Received Bids</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4">Seller</th>
                    <th className="px-6 py-4">Offered Price</th>
                    <th className="px-6 py-4">Quantity</th>
                    <th className="px-6 py-4">Timeline</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {requirement.responses.map((resp: any) => (
                    <tr key={resp.id} className="hover:bg-slate-50/40 transition">
                      <td className="px-6 py-4 font-bold text-slate-900">{resp.sellerOrganization.organizationName}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">${resp.offeredPrice}</td>
                      <td className="px-6 py-4 text-slate-600">{resp.offeredQuantity}</td>
                      <td className="px-6 py-4 text-slate-600">{resp.deliveryTimeline}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-black uppercase text-blue-700 border border-blue-100">
                          {resp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-[#0b2447] mb-4">Requirement Summary</h3>
            <div className="space-y-3 text-sm font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-400">Visibility</span>
                <span className="text-slate-700">{requirement.visibility}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className="text-slate-700">{requirement.status}</span>
              </div>
            </div>
            <hr className="my-4 border-slate-100" />
            <p className="text-xs leading-relaxed text-slate-500 font-medium">
              This requirement is visible to all verified sellers in the Marketplace. 
              Bids submitted after the deadline will not be considered.
            </p>
          </div>
        </div>
      </div>

      {/* Bid Submission Modal */}
      {isBidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsBidModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-black text-[#0b2447] mb-6">Submit Your Bid</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Offered Price ($)</label>
                <input 
                  type="number" 
                  value={bidForm.offeredPrice}
                  onChange={(e) => setBidForm({...bidForm, offeredPrice: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0b2447] font-semibold"
                  placeholder="e.g. 14000"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Offered Quantity</label>
                <input 
                  type="number" 
                  value={bidForm.offeredQuantity}
                  onChange={(e) => setBidForm({...bidForm, offeredQuantity: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0b2447] font-semibold"
                  placeholder="e.g. 500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Delivery Timeline</label>
                <input 
                  type="text" 
                  value={bidForm.deliveryTimeline}
                  onChange={(e) => setBidForm({...bidForm, deliveryTimeline: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0b2447] font-semibold"
                  placeholder="e.g. 2 Weeks"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Message</label>
                <textarea 
                  rows={3} 
                  value={bidForm.message}
                  onChange={(e) => setBidForm({...bidForm, message: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0b2447] font-semibold resize-none"
                  placeholder="Add details, certifications or specifications..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button 
                  onClick={() => setIsBidModalOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50 active:scale-95 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBidSubmit}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0b2447] px-5 text-xs font-black text-white shadow-sm hover:bg-[#12335f] active:scale-95 transition"
                >
                  <Send className="h-3.5 w-3.5" /> Submit Bid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerRequirementDetailsPage;