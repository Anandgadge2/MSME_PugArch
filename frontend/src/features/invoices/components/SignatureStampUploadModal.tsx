import React, { useState, useRef } from 'react';
import { X, Upload, Check, RefreshCw, Stamp, FileSignature, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { toast } from 'sonner';
import { putApi } from '../../shared/apiClient';

interface SignatureStampUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (branding: { logoUrl: string | null; stampUrl: string | null; signatureUrl: string | null }) => void;
  initialLogo?: string | null;
  initialStamp?: string | null;
  initialSignature?: string | null;
}

export function SignatureStampUploadModal({
  isOpen,
  onClose,
  onSaved,
  initialLogo,
  initialStamp,
  initialSignature
}: SignatureStampUploadModalProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogo || null);
  const [stampUrl, setStampUrl] = useState<string | null>(initialStamp || null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(initialSignature || null);
  
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [saving, setSaving] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'stamp' | 'signature'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    const setLoader = type === 'logo' ? setUploadingLogo : type === 'stamp' ? setUploadingStamp : setUploadingSignature;
    setLoader(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (!res.ok) {
        // Fallback: Read as base64 Data URL if upload endpoint is unavailable
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const dataUrl = readerEvent.target?.result as string;
          if (type === 'logo') setLogoUrl(dataUrl);
          if (type === 'stamp') setStampUrl(dataUrl);
          if (type === 'signature') setSignatureUrl(dataUrl);
          toast.success(`${type.toUpperCase()} loaded successfully`);
        };
        reader.readAsDataURL(file);
        return;
      }

      const data = await res.json();
      const uploadedUrl = data.url || (data.fileId ? `/api/files/${data.fileId}/view` : null);

      if (uploadedUrl) {
        if (type === 'logo') setLogoUrl(uploadedUrl);
        if (type === 'stamp') setStampUrl(uploadedUrl);
        if (type === 'signature') setSignatureUrl(uploadedUrl);
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`);
      } else {
        throw new Error('Upload did not return a valid URL');
      }
    } catch (err: any) {
      // Graceful fallback to DataURL
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const dataUrl = readerEvent.target?.result as string;
        if (type === 'logo') setLogoUrl(dataUrl);
        if (type === 'stamp') setStampUrl(dataUrl);
        if (type === 'signature') setSignatureUrl(dataUrl);
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} loaded successfully`);
      };
      reader.readAsDataURL(file);
    } finally {
      setLoader(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save locally
      if (typeof window !== 'undefined') {
        if (logoUrl) localStorage.setItem('msme_invoice_logo', logoUrl);
        else localStorage.removeItem('msme_invoice_logo');

        if (stampUrl) localStorage.setItem('msme_invoice_stamp', stampUrl);
        else localStorage.removeItem('msme_invoice_stamp');

        if (signatureUrl) localStorage.setItem('msme_invoice_signature', signatureUrl);
        else localStorage.removeItem('msme_invoice_signature');
      }

      // Save to backend if user is authenticated
      try {
        await putApi('/api/user/invoice-branding', {
          logoUrl: logoUrl || null,
          stampUrl: stampUrl || null,
          signatureUrl: signatureUrl || null
        });
      } catch {
        // Local persistence still active
      }

      toast.success('Invoice branding and signatures updated successfully!');
      onSaved({ logoUrl, stampUrl, signatureUrl });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = () => {
    setLogoUrl(null);
    setStampUrl(null);
    setSignatureUrl(null);
    toast.info('Cleared logo, stamp, and signature. Invoice will use clean format.');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-150 pb-4 mb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#12335f] bg-[#12335f]/10 px-2.5 py-0.5 rounded-full">
              Invoice Branding Utility
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-1">Company Logo, Stamp & Signature</h2>
            <p className="text-xs text-slate-500 font-medium">
              Upload your company logo, official round stamp, and authorized signature. Uploading or leaving none is supported.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Upload Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Logo Upload */}
            <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 flex flex-col justify-between items-center text-center">
              <div className="w-full">
                <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-800 mb-2">
                  <ImageIcon className="h-4 w-4 text-[#12335f]" />
                  <span>Company Logo</span>
                </div>
                <div className="h-24 w-full bg-white rounded-xl border border-slate-200 p-2 flex items-center justify-center shadow-xs overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">No logo (None)</span>
                  )}
                </div>
              </div>
              <div className="mt-3 w-full space-y-1.5">
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={(e) => handleFileUpload(e, 'logo')}
                  accept="image/png, image/jpeg, image/svg+xml"
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full h-8 text-[10px] font-black uppercase rounded-lg border-slate-200 bg-white hover:bg-slate-100"
                >
                  {uploadingLogo ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                  {logoUrl ? 'Change Logo' : 'Upload Logo'}
                </Button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="text-[9px] font-bold text-red-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <Trash2 className="h-2.5 w-2.5" /> Remove (No Logo)
                  </button>
                )}
              </div>
            </div>

            {/* 2. Stamp Upload */}
            <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 flex flex-col justify-between items-center text-center">
              <div className="w-full">
                <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-800 mb-2">
                  <Stamp className="h-4 w-4 text-indigo-600" />
                  <span>Round Stamp / Seal</span>
                </div>
                <div className="h-24 w-full bg-white rounded-xl border border-slate-200 p-2 flex items-center justify-center shadow-xs overflow-hidden">
                  {stampUrl ? (
                    <img src={stampUrl} alt="Stamp" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">No stamp (None)</span>
                  )}
                </div>
              </div>
              <div className="mt-3 w-full space-y-1.5">
                <input
                  type="file"
                  ref={stampInputRef}
                  onChange={(e) => handleFileUpload(e, 'stamp')}
                  accept="image/png, image/jpeg, image/svg+xml"
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadingStamp}
                  onClick={() => stampInputRef.current?.click()}
                  className="w-full h-8 text-[10px] font-black uppercase rounded-lg border-slate-200 bg-white hover:bg-slate-100"
                >
                  {uploadingStamp ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                  {stampUrl ? 'Change Stamp' : 'Upload Stamp'}
                </Button>
                {stampUrl && (
                  <button
                    type="button"
                    onClick={() => setStampUrl(null)}
                    className="text-[9px] font-bold text-red-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <Trash2 className="h-2.5 w-2.5" /> Remove (No Stamp)
                  </button>
                )}
              </div>
            </div>

            {/* 3. Signature Upload */}
            <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 flex flex-col justify-between items-center text-center">
              <div className="w-full">
                <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-800 mb-2">
                  <FileSignature className="h-4 w-4 text-emerald-600" />
                  <span>Authorized Signature</span>
                </div>
                <div className="h-24 w-full bg-white rounded-xl border border-slate-200 p-2 flex items-center justify-center shadow-xs overflow-hidden">
                  {signatureUrl ? (
                    <img src={signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">No signature (None)</span>
                  )}
                </div>
              </div>
              <div className="mt-3 w-full space-y-1.5">
                <input
                  type="file"
                  ref={sigInputRef}
                  onChange={(e) => handleFileUpload(e, 'signature')}
                  accept="image/png, image/jpeg, image/svg+xml"
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadingSignature}
                  onClick={() => sigInputRef.current?.click()}
                  className="w-full h-8 text-[10px] font-black uppercase rounded-lg border-slate-200 bg-white hover:bg-slate-100"
                >
                  {uploadingSignature ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                  {signatureUrl ? 'Change Signature' : 'Upload Signature'}
                </Button>
                {signatureUrl && (
                  <button
                    type="button"
                    onClick={() => setSignatureUrl(null)}
                    className="text-[9px] font-bold text-red-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <Trash2 className="h-2.5 w-2.5" /> Remove (No Signature)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-900 text-white">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Live Signatory Preview
              </span>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                {stampUrl || signatureUrl ? 'Active Stamp & Signature' : 'Clean Signatory Box (None)'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl p-4 text-slate-900 border border-slate-300">
              <div className="text-xs space-y-1">
                <p className="font-black text-slate-800 text-[11px]">Bank Details: Verified</p>
                <p className="text-[10px] text-slate-500 font-mono">STATE BANK OF INDIA • SBIN0001234</p>
              </div>
              <div className="relative flex items-center justify-center p-2 rounded-lg border border-slate-200 min-w-[140px] h-[75px] bg-slate-50">
                {stampUrl && (
                  <img src={stampUrl} alt="Stamp preview" className="h-16 w-16 object-contain" />
                )}
                {signatureUrl && (
                  <img src={signatureUrl} alt="Signature preview" className={stampUrl ? "absolute h-10 w-auto object-contain mix-blend-multiply" : "h-10 w-auto object-contain"} />
                )}
                {!stampUrl && !signatureUrl && (
                  <span className="text-[10px] font-bold text-slate-400 italic">No stamp / sign attached</span>
                )}
                <span className="absolute bottom-1 right-2 text-[8px] font-bold text-slate-400 uppercase">
                  Authorized Signatory
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-150 mt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearAll}
            className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1.5 h-9"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All (No Stamp / Logo / Sign)
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 sm:flex-initial h-9 rounded-lg text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-initial h-9 rounded-lg bg-[#12335f] text-white hover:bg-slate-800 text-xs font-black uppercase tracking-wider"
            >
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Save & Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
