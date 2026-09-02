import { FormEvent, useEffect, useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Eye,
  FileText,
  ImageIcon,
  Plus,
  Trash2,
  Upload,
  FileUp,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Package,
  Wrench,
  ShieldCheck,
  BadgeCheck,
  Tag,
  Check,
  AlertCircle,
  Sparkles,
  Info,
  CheckCircle2,
  IndianRupee,
  Layers,
  HelpCircle,
  Percent,
  FileSpreadsheet,
  Calendar,
  Building2,
  Clock,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Badge, Card, CardContent } from '../../../components/ui/card';
import { Input, Select } from '../../../components/ui/input';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../lib/utils';
import { InlineError, LoadingState } from '../../shared/FeatureStates';
import type { CategoryDto } from '../../shared/types';
import { catalogueApi } from '../api';
import { getFileAssetPreview, type DocumentPreview } from '../../../lib/files';
import { DocumentPreviewModal } from '../../../components/DocumentPreviewModal';
import { QUANTITY_UNITS, ITEM_CONDITIONS } from '../../../constants/dropdowns';
import { api, BASE_URL } from '../../../lib/api';
import { GstTaxPicker, calculateGstBreakdown } from '../../shared/gstTax';

type ItemKind = 'product' | 'service';

const blankForm = {
  name: '',
  description: '',
  price: '',
  splitTaxRate: '',
  igstTaxRate: '0.00',
  otherTaxRate: '',
  discount: '0.00',
  originalPrice: '',
  discountPrice: '',
  discountPercent: '',
  offerLabel: '',
  offerStartAt: '',
  offerEndAt: '',
  isOfferActive: false,
  bulkDealAvailable: false,
  bulkMinQuantity: '',
  hsnCode: '',
  unitOfMeasure: '',
  itemCondition: '',
  basePrice: '',
  pricingModel: 'FIXED',
  serviceArea: '',
  status: 'ACTIVE',
  categoryId: '',
  sku: '',
  brand: '',
  modelNumber: '',
  isMsmeMade: true,
  scopeOfWork: '',
  deliverables: '',
  inclusions: '',
  exclusions: '',
  duration: '',
  slaResponseTime: ''
};

type SpecRow = { name: string; value: string; unit: string };

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'object') {
    const maybeDecimal = value as { toString?: () => string; value?: unknown };
    if (maybeDecimal.value !== undefined) return toNumber(maybeDecimal.value);
    if (typeof maybeDecimal.toString === 'function') {
      const parsed = Number(maybeDecimal.toString());
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCatalogueImageUrl = (fileId: number | string | undefined) => {
  if (!fileId) return '';
  const token = localStorage.getItem('token') || '';
  return `${BASE_URL}/api/files/${fileId}/view?token=${encodeURIComponent(token)}`;
};

const fileIdOf = (value: any, options: { preferNestedFileAsset?: boolean } = {}) => {
  const fileId = options.preferNestedFileAsset
    ? value?.fileAssetId || value?.fileId || value?.fileAsset?.id || value?.fileAsset?.fileAssetId || value?.id
    : value?.fileAssetId || value?.fileId || value?.id || value?.fileAsset?.id || value?.fileAsset?.fileAssetId;
  return fileId === undefined || fileId === null ? undefined : Number(fileId);
};

const normalizeUploadedAsset = (asset: any, fallback?: File) => {
  const source = asset?.file || asset?.data || asset;
  const id = fileIdOf(source) || fileIdOf(asset);
  return {
    ...source,
    id,
    fileId: id,
    fileAssetId: id,
    originalName: source?.originalName || fallback?.name,
    mimeType: source?.mimeType || fallback?.type
  };
};

const mediaToUploadedAsset = (media: any) => ({
  id: media.fileId,
  fileId: media.fileId,
  fileAssetId: media.fileId,
  originalName: media.originalName || media.label,
  mimeType: media.mimeType
});

const uploadedAssetIds = (assets: any[]) =>
  Array.from(new Set(assets.map(asset => fileIdOf(asset)).filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0)));

const uploadCatalogueAsset = async (file: File) => {
  const buildBody = () => {
    const fd = new FormData();
    fd.append('file', file);
    return fd;
  };
  const endpoints = ['/api/catalogue/upload', '/api/upload?entityType=catalogue'];
  let lastError = '';

  for (const endpoint of endpoints) {
    const res = await api.fetch(endpoint, {
      method: 'POST',
      body: buildBody()
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return normalizeUploadedAsset(data, file);
    lastError = data?.message || data?.error || res.statusText || 'Upload failed';
    if (![404, 405].includes(res.status)) break;
  }

  throw new Error(lastError);
};

const looksLikeImage = (value: { mimeType?: string; originalName?: string; label?: string }) => {
  const mimeType = String(value.mimeType || '').toLowerCase();
  const name = String(value.originalName || value.label || '').toLowerCase().split('?')[0];
  return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name);
};

const catalogueMedia = (item: any) => {
  const media: any[] = [];

  item.images?.forEach((image: any, index: number) => {
    const fileId = fileIdOf(image, { preferNestedFileAsset: true });
    if (!fileId) return;
    media.push({
      id: fileId,
      fileId,
      label: image.altText || image.fileAsset?.originalName || `Product image ${index + 1}`,
      mimeType: image.fileAsset?.mimeType,
      originalName: image.fileAsset?.originalName,
      kind: 'image'
    });
  });

  item.certifications?.forEach((cert: any, index: number) => {
    const fileId = fileIdOf(cert, { preferNestedFileAsset: true });
    if (!fileId) return;
    const entry = {
      id: fileId,
      fileId,
      label: cert.name || cert.fileAsset?.originalName || `Certification ${index + 1}`,
      mimeType: cert.fileAsset?.mimeType || undefined,
      originalName: cert.fileAsset?.originalName || undefined
    };
    media.push({ ...entry, kind: looksLikeImage(entry) ? 'image' : 'document' });
  });

  item.catalogueFiles?.forEach((file: any, index: number) => {
    const fileId = fileIdOf(file);
    if (!fileId) return;
    const entry = {
      id: fileId,
      fileId,
      label: file.originalName || `Catalogue file ${index + 1}`,
      mimeType: file.mimeType,
      originalName: file.originalName
    };
    media.push({ ...entry, kind: looksLikeImage(entry) ? 'image' : 'document' });
  });

  const seen = new Set<number>();
  return media.filter(item => {
    if (!item.fileId || seen.has(item.fileId)) return false;
    seen.add(item.fileId);
    return true;
  });
};

export default function CatalogueFormPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '';

  // Parse path to determine kind and action
  const productMatch = pathname.match(/\/products\/(new|[^/]+)/);
  const serviceMatch = pathname.match(/\/services\/(new|[^/]+)/);

  const kind: ItemKind = productMatch ? 'product' : 'service';
  const isEdit = pathname.includes('/edit');
  const idStr = productMatch ? productMatch[1] : (serviceMatch ? serviceMatch[1] : null);
  const id = (isEdit && idStr && idStr !== 'new') ? Number(idStr) : null;

  const [categoryList, setCategoryList] = useState<CategoryDto[]>([]);
  const [otherCategoryName, setOtherCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(blankForm);
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreview | null>(null);
  const [specifications, setSpecifications] = useState<SpecRow[]>([]);
  const [activeTab, setActiveTab] = useState<'basic' | 'attributes' | 'pricing' | 'specs'>('basic');

  // Touch and submission state for validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  useEffect(() => {
    const initPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const categories = await catalogueApi.categories();
        setCategoryList(categories || []);

        if (isEdit && id) {
          const item = kind === 'product'
            ? await catalogueApi.getProduct(id)
            : await catalogueApi.getService(id);

          if (item) {
            setForm({
              name: item.name || '',
              description: item.description || '',
              price: item.price === null || item.price === undefined ? '' : String(item.price),
              splitTaxRate: '',
              igstTaxRate: item.taxRate === null || item.taxRate === undefined ? '0.00' : String(item.taxRate),
              otherTaxRate: '',
              discount: item.discount === null || item.discount === undefined ? '0.00' : String(item.discount),
              originalPrice: item.originalPrice === null || item.originalPrice === undefined ? '' : String(item.originalPrice),
              discountPrice: item.discountPrice === null || item.discountPrice === undefined ? '' : String(item.discountPrice),
              discountPercent: item.discountPercent === null || item.discountPercent === undefined ? '' : String(item.discountPercent),
              offerLabel: item.offerLabel || '',
              offerStartAt: item.offerStartAt ? String(item.offerStartAt).slice(0, 10) : '',
              offerEndAt: item.offerEndAt ? String(item.offerEndAt).slice(0, 10) : '',
              isOfferActive: Boolean(item.isOfferActive),
              bulkDealAvailable: Boolean(item.bulkDealAvailable),
              bulkMinQuantity: item.bulkMinQuantity === null || item.bulkMinQuantity === undefined ? '' : String(item.bulkMinQuantity),
              hsnCode: item.hsnCode || '',
              unitOfMeasure: item.unitOfMeasure || '',
              itemCondition: item.itemCondition || '',
              basePrice: item.basePrice === null || item.basePrice === undefined ? '' : String(item.basePrice),
              pricingModel: item.pricingModel || 'FIXED',
              serviceArea: item.serviceArea || '',
              status: item.status || 'ACTIVE',
              categoryId: String(item.categoryId || ''),
              sku: item.sku || '',
              brand: item.brand || '',
              modelNumber: item.modelNumber || '',
              isMsmeMade: item.isMsmeMade !== undefined ? Boolean((item as any).isMsmeMade) : true,
              scopeOfWork: (item as any).scopeOfWork || '',
              deliverables: (item as any).deliverables || '',
              inclusions: (item as any).inclusions || '',
              exclusions: (item as any).exclusions || '',
              duration: (item as any).duration || '',
              slaResponseTime: (item as any).slaResponseTime || ''
            });
            setSpecifications(((item as any).specifications || []).map((s: any) => ({
              name: s.name || '',
              value: s.value || '',
              unit: s.unit || ''
            })));
            const media = catalogueMedia(item);
            setUploadedImages(media.filter(file => file.kind === 'image').map(mediaToUploadedAsset));
            setUploadedDocuments(media.filter(file => file.kind === 'document').map(mediaToUploadedAsset));
          } else {
            setError(`${kind === 'product' ? 'Product' : 'Service'} not found.`);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to initialize form.');
      } finally {
        setLoading(false);
      }
    };

    void initPage();
  }, [id, isEdit, kind]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large. Max size is 10MB.`);
          continue;
        }

        const rawAsset = await uploadCatalogueAsset(file);
        if (!rawAsset.id) {
          toast.error(`Upload succeeded but ${file.name} was not saved with a file id.`);
          continue;
        }
        const localUrl = URL.createObjectURL(file);
        const asset = { ...rawAsset, localUrl };
        if (type === 'image') {
          setUploadedImages(prev => [...prev, asset]);
          markTouched('images');
        } else {
          setUploadedDocuments(prev => [...prev, asset]);
        }
        toast.success(`${file.name} uploaded successfully.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload file.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeUploadedFile = (fileId: number, type: 'image' | 'document') => {
    if (type === 'image') {
      const removed = uploadedImages.find(img => img.id === fileId);
      if (removed?.localUrl) URL.revokeObjectURL(removed.localUrl);
      setUploadedImages(prev => {
        const next = prev.filter(img => img.id !== fileId);
        if (next.length === 0) markTouched('images');
        return next;
      });
    } else {
      const removed = uploadedDocuments.find(doc => doc.id === fileId);
      if (removed?.localUrl) URL.revokeObjectURL(removed.localUrl);
      setUploadedDocuments(prev => prev.filter(doc => doc.id !== fileId));
    }
  };

  const updateForm = (field: keyof typeof blankForm, value: string | boolean) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  // Step validation computations
  const isStep1Valid = useMemo(() => {
    const hasName = Boolean(form.name.trim());
    const hasCategory = Boolean(form.categoryId) && (form.categoryId !== 'OTHER' || Boolean(otherCategoryName.trim()));
    const hasDescription = Boolean(form.description.trim());
    return hasName && hasCategory && hasDescription;
  }, [form.name, form.categoryId, otherCategoryName, form.description]);

  const isStep2Valid = useMemo(() => {
    if (kind === 'product') {
      return (
        Boolean(form.unitOfMeasure.trim()) &&
        Boolean(form.itemCondition.trim()) &&
        Boolean(form.hsnCode.trim())
      );
    }
    return (
      Boolean(form.serviceArea.trim()) &&
      Boolean(form.duration.trim()) &&
      Boolean(form.slaResponseTime.trim()) &&
      Boolean(form.scopeOfWork.trim()) &&
      Boolean(form.pricingModel.trim())
    );
  }, [kind, form.unitOfMeasure, form.itemCondition, form.hsnCode, form.serviceArea, form.duration, form.slaResponseTime, form.scopeOfWork, form.pricingModel]);

  const isStep3Valid = useMemo(() => {
    const priceVal = kind === 'product' ? form.price : form.basePrice;
    const hasPrice = priceVal !== '' && toNumber(priceVal) > 0;
    const hasTax = (form.splitTaxRate !== '' && Number(form.splitTaxRate) >= 0) || (form.igstTaxRate !== '' && Number(form.igstTaxRate) >= 0);
    return Boolean(hasPrice && hasTax);
  }, [kind, form.price, form.basePrice, form.splitTaxRate, form.igstTaxRate]);

  const isStep4Valid = useMemo(() => {
    return uploadedImages.length >= 1;
  }, [uploadedImages.length]);

  const isAllValid = isStep1Valid && isStep2Valid && isStep3Valid && isStep4Valid;

  // Health Score Calculation
  const completionPercentage = useMemo(() => {
    let score = 0;
    if (isStep1Valid) score += 30;
    else if (form.name.trim() || form.categoryId) score += 15;

    if (isStep2Valid) score += 25;
    else if (form.unitOfMeasure || form.serviceArea) score += 10;

    if (isStep3Valid) score += 25;
    else if (form.price || form.basePrice) score += 10;

    if (isStep4Valid) score += 20;

    return Math.min(100, score);
  }, [isStep1Valid, isStep2Valid, isStep3Valid, isStep4Valid, form]);

  const isFieldInvalid = (field: string) => {
    switch (field) {
      case 'name':
        return !form.name.trim();
      case 'categoryId':
        return !form.categoryId || (form.categoryId === 'OTHER' && !otherCategoryName.trim());
      case 'description':
        return !form.description.trim();
      case 'unitOfMeasure':
        return kind === 'product' && !form.unitOfMeasure.trim();
      case 'itemCondition':
        return kind === 'product' && !form.itemCondition.trim();
      case 'hsnCode':
        return kind === 'product' && !form.hsnCode.trim();
      case 'serviceArea':
        return kind === 'service' && !form.serviceArea.trim();
      case 'duration':
        return kind === 'service' && !form.duration.trim();
      case 'slaResponseTime':
        return kind === 'service' && !form.slaResponseTime.trim();
      case 'scopeOfWork':
        return kind === 'service' && !form.scopeOfWork.trim();
      case 'pricingModel':
        return kind === 'service' && !form.pricingModel.trim();
      case 'price':
        return kind === 'product' && (form.price === '' || toNumber(form.price) <= 0);
      case 'basePrice':
        return kind === 'service' && (form.basePrice === '' || toNumber(form.basePrice) <= 0);
      case 'taxRate':
        return form.splitTaxRate === '' && form.igstTaxRate === '';
      case 'images':
        return uploadedImages.length < 1;
      default:
        return false;
    }
  };

  const getFieldError = (field: string): string | undefined => {
    if (!touched[field] && !attemptedSubmit) return undefined;
    if (!isFieldInvalid(field)) return undefined;

    switch (field) {
      case 'name':
        return `${kind === 'product' ? 'Product' : 'Service'} name is required.`;
      case 'categoryId':
        if (form.categoryId === 'OTHER' && !otherCategoryName.trim()) {
          return 'Please specify custom category name.';
        }
        return 'Category is required.';
      case 'description':
        return 'Description is required.';
      case 'unitOfMeasure':
        return 'Unit of measure is required.';
      case 'itemCondition':
        return 'Item condition is required.';
      case 'hsnCode':
        return 'HSN code is required.';
      case 'serviceArea':
        return 'Service area is required.';
      case 'duration':
        return 'Duration is required.';
      case 'slaResponseTime':
        return 'SLA / Response time is required.';
      case 'scopeOfWork':
        return 'Scope of work is required.';
      case 'pricingModel':
        return 'Pricing model is required.';
      case 'price':
        return 'Price is required and must be greater than 0.';
      case 'basePrice':
        return 'Base price is required and must be greater than 0.';
      case 'taxRate':
        return 'GST / Tax rate selection is required.';
      case 'images':
        return `At least 1 ${kind} image is required.`;
      default:
        return undefined;
    }
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    setAttemptedSubmit(true);

    if (!isAllValid) {
      if (!isStep1Valid) {
        setActiveTab('basic');
        toast.error('Please complete all required fields in Step 1 (Basic Info).');
        return;
      }
      if (!isStep2Valid) {
        setActiveTab('attributes');
        toast.error(`Please complete all required fields in Step 2 (${kind === 'product' ? 'Attributes' : 'Service Specs'}).`);
        return;
      }
      if (!isStep3Valid) {
        setActiveTab('pricing');
        toast.error('Please complete all required fields in Step 3 (Pricing & GST).');
        return;
      }
      if (!isStep4Valid) {
        setActiveTab('specs');
        toast.error(`Please upload at least 1 ${kind} image.`);
        return;
      }
      return;
    }

    setSaving(true);
    try {
      let resolvedCategoryId: number | null = form.categoryId && form.categoryId !== 'OTHER' ? Number(form.categoryId) : null;

      if (form.categoryId === 'OTHER') {
        if (!otherCategoryName.trim()) {
          toast.error('Please specify custom category name.');
          setSaving(false);
          return;
        }
        const catRes = await api.fetch('/api/categories/custom', {
          method: 'POST',
          body: JSON.stringify({
            name: otherCategoryName.trim(),
            type: kind === 'service' ? 'SERVICE' : 'PRODUCT'
          })
        });
        if (catRes.ok) {
          const createdCat = await catRes.json();
          resolvedCategoryId = createdCat.id;
        } else {
          toast.error('Failed to create custom category.');
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        categoryId: resolvedCategoryId,
        status: form.status,
        currency: 'INR',
        imageIds: uploadedAssetIds(uploadedImages),
        documentIds: uploadedAssetIds(uploadedDocuments),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
        discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
        offerLabel: form.offerLabel.trim() || null,
        offerStartAt: form.offerStartAt || null,
        offerEndAt: form.offerEndAt || null,
        isOfferActive: Boolean(form.isOfferActive),
        bulkDealAvailable: Boolean(form.bulkDealAvailable),
        bulkMinQuantity: form.bulkMinQuantity ? Number(form.bulkMinQuantity) : null,
        specifications: specifications.filter(s => s.name.trim() && s.value.trim()).map(s => ({
          name: s.name.trim(),
          value: s.value.trim(),
          unit: s.unit.trim() || null
        })),
        ...(kind === 'product'
          ? {
            price: form.price ? Number(form.price) : null,
            taxRate: (form.splitTaxRate ? Number(form.splitTaxRate) : 0) + (form.igstTaxRate ? Number(form.igstTaxRate) : 0) + (form.otherTaxRate ? Number(form.otherTaxRate) : 0),
            discount: form.discount ? Number(form.discount) : 0,
            hsnCode: form.hsnCode.trim() || null,
            unitOfMeasure: form.unitOfMeasure.trim() || null,
            itemCondition: form.itemCondition.trim() || null,
            sku: form.sku.trim() || null,
            brand: form.brand.trim() || null,
            modelNumber: form.modelNumber.trim() || null,
            isMsmeMade: Boolean(form.isMsmeMade)
          }
          : {
            basePrice: form.basePrice ? Number(form.basePrice) : null,
            taxRate: (form.splitTaxRate ? Number(form.splitTaxRate) : 0) + (form.igstTaxRate ? Number(form.igstTaxRate) : 0) + (form.otherTaxRate ? Number(form.otherTaxRate) : 0),
            discount: form.discount ? Number(form.discount) : 0,
            pricingModel: form.pricingModel,
            serviceArea: form.serviceArea.trim() || null,
            scopeOfWork: form.scopeOfWork.trim() || null,
            deliverables: form.deliverables.trim() || null,
            inclusions: form.inclusions.trim() || null,
            exclusions: form.exclusions.trim() || null,
            duration: form.duration.trim() || null,
            slaResponseTime: form.slaResponseTime.trim() || null
          })
      };

      if (isEdit && id) {
        if (kind === 'product') {
          await catalogueApi.updateProduct(id, payload);
          toast.success('Product updated successfully.');
        } else {
          await catalogueApi.updateService(id, payload);
          toast.success('Service updated successfully.');
        }
      } else {
        if (kind === 'product') {
          await catalogueApi.createProduct(payload);
          toast.success('Product added to your marketplace catalogue.');
        } else {
          await catalogueApi.createService(payload);
          toast.success('Service added to your marketplace catalogue.');
        }
      }
      uploadedImages.forEach(img => { if (img.localUrl) URL.revokeObjectURL(img.localUrl); });
      uploadedDocuments.forEach(doc => { if (doc.localUrl) URL.revokeObjectURL(doc.localUrl); });
      router.push('/seller/catalogue');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save marketplace item');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    uploadedImages.forEach(img => { if (img.localUrl) URL.revokeObjectURL(img.localUrl); });
    uploadedDocuments.forEach(doc => { if (doc.localUrl) URL.revokeObjectURL(doc.localUrl); });
    router.push('/seller/catalogue');
  };

  if (loading) return <LoadingState label="Loading catalogue form..." />;
  if (error) return <InlineError message={error} onRetry={() => router.push('/seller/catalogue')} />;

  const title = isEdit ? `Edit ${kind === 'product' ? 'Product' : 'Service'}` : `New ${kind === 'product' ? 'Product' : 'Service'}`;
  const subtitle = isEdit
    ? `Update pricing, specifications, and media for your marketplace ${kind}.`
    : `Publish a high-converting ${kind} listing on the Synergy MSME marketplace.`;
  const rawPrice = kind === 'product' ? toNumber(form.price) : toNumber(form.basePrice);
  const discountAmount = rawPrice * (toNumber(form.discount) / 100);
  const taxableAmount = Math.max(0, rawPrice - discountAmount);
  const taxBreakdown = calculateGstBreakdown(taxableAmount, form.splitTaxRate, form.igstTaxRate, form.otherTaxRate);
  const selectedCategory = categoryList.find(c => String(c.id) === String(form.categoryId));

  const steps = [
    { id: 'basic', number: '1', title: 'Basic Info', sub: 'Identity & Category', icon: FileText, isValid: isStep1Valid },
    { id: 'attributes', number: '2', title: kind === 'product' ? 'Attributes' : 'Service Specs', sub: kind === 'product' ? 'HSN, SKU & Brand' : 'SLA & Scope', icon: Wrench, isValid: isStep2Valid },
    { id: 'pricing', number: '3', title: 'Pricing & GST', sub: 'Rates & Tax Breakdown', icon: Tag, isValid: isStep3Valid },
    { id: 'specs', number: '4', title: 'Specs & Media', sub: 'Images & Technical Data', icon: Layers, isValid: isStep4Valid }
  ];

  return (
    <div className="space-y-4 min-w-0 max-w-[1480px] mx-auto pb-12">
      {/* Sleek, Compact Enterprise Header (Eliminates dead vertical space) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Title & Nav */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleCancel}
              className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:scale-95 cursor-pointer"
              title="Return to catalogue"
              aria-label="Back to Catalogue"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <span className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg text-white shadow-xs text-xs",
                    kind === 'product' ? "bg-emerald-600" : "bg-[#12335f]"
                  )}>
                    {kind === 'product' ? <Package className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                  </span>
                  {title}
                </h1>
                {/* <Badge variant="default" className="border-slate-200 bg-slate-100/70 text-[10px] font-bold text-slate-700 uppercase tracking-wider py-0.5 px-2">
                  {isEdit ? 'Revision Mode' : `${kind.toUpperCase()} WIZARD`}
                </Badge> */}
                {form.isMsmeMade && (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold px-2 py-0.5">
                    MSME Verified
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate hidden sm:block mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Right Status / Trust Chips */}
          <div className="flex items-center gap-2 text-xs">
            <div className="hidden md:flex items-center gap-3 border-r border-slate-200 pr-3 text-slate-600">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Fast Verification</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <BadgeCheck className="h-3.5 w-3.5 text-blue-600" />
                <span>RFQ Enabled</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="h-8 rounded-lg text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 px-3 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={(e) => submitForm(e as any)}
                disabled={saving || uploading}
                className={cn(
                  "h-8 rounded-lg text-xs font-bold text-white shadow-xs px-3.5 transition-all cursor-pointer",
                  kind === 'product' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#12335f] hover:bg-[#0e274a]"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    {isEdit ? 'Save Changes' : `Publish ${kind === 'product' ? 'Product' : 'Service'}`}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-step Form & Sticky Sidebar Layout */}
      <form onSubmit={submitForm} className="grid gap-4 lg:grid-cols-12 items-start">
        {/* Left Column: Form & Stepper (Span 8) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Integrated Modern Step Navigation Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-sm" role="tablist" aria-label="Creation Steps">
            {steps.map((s) => {
              const Icon = s.icon;
              const isActive = activeTab === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(s.id as any)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-200 outline-none relative group cursor-pointer",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                    isActive
                      ? "bg-white/20 text-white"
                      : s.isValid
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                  )}>
                    {s.isValid ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : s.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate leading-tight">{s.title}</span>
                      {s.isValid && !isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] truncate block leading-tight",
                      isActive ? "text-slate-300" : "text-slate-400"
                    )}>
                      {s.sub}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Form Card Content */}
          <Card className="border-slate-200/90 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* TAB 1: BASIC INFORMATION */}
              {activeTab === 'basic' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        Step 1: General & Classification
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">Specify core identification, naming, and marketplace visibility status.</p>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                      Step 1 of 4
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Input
                        label={`${kind === 'product' ? 'Product' : 'Service'} Name`}
                        value={form.name}
                        onChange={event => { updateForm('name', event.target.value); markTouched('name'); }}
                        onBlur={() => markTouched('name')}
                        error={getFieldError('name')}
                        required
                        placeholder={kind === 'product' ? "e.g. Industrial Structural Steel Beams (IS 2062)" : "e.g. Turnkey Solar Plant Installation & EPC Services"}
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      />
                    </div>

                    <div>
                      <Select
                        label="Category"
                        value={form.categoryId}
                        onChange={event => { updateForm('categoryId', event.target.value); markTouched('categoryId'); }}
                        onBlur={() => markTouched('categoryId')}
                        error={getFieldError('categoryId')}
                        required
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      >
                        <option value="">Select Category</option>
                        {categoryList.map(cat => <option key={cat.id} value={String(cat.id)}>{cat.name}</option>)}
                        <option value="OTHER">+ Add Custom Category</option>
                      </Select>
                    </div>

                    <div>
                      <Select
                        label="Marketplace Status"
                        value={form.status}
                        onChange={event => updateForm('status', event.target.value)}
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      >
                        <option value="ACTIVE">Active (Live in Search & RFQ)</option>
                        <option value="DRAFT">Draft (Save privately)</option>
                        <option value="INACTIVE">Inactive (Hidden from buyers)</option>
                      </Select>
                    </div>

                    {form.categoryId === 'OTHER' && (
                      <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                          <span>Custom Category Request</span>
                        </div>
                        <Input
                          label="Enter Custom Category Name"
                          value={otherCategoryName}
                          onChange={event => { setOtherCategoryName(event.target.value); markTouched('categoryId'); }}
                          onBlur={() => markTouched('categoryId')}
                          error={form.categoryId === 'OTHER' && !otherCategoryName.trim() && (touched.categoryId || attemptedSubmit) ? 'Please specify custom category name.' : undefined}
                          placeholder="e.g. Green Hydrogen Electrolyzers, Precision Aerospace Tooling"
                          className="bg-white text-xs h-9"
                          required
                        />
                        <p className="text-[10px] text-blue-700">This category will be reviewed and automatically tagged with your enterprise catalogue.</p>
                      </div>
                    )}

                    <div className="sm:col-span-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold sm:font-extrabold uppercase tracking-wide text-slate-600 sm:text-[11px]">
                          Item Description <span className="text-red-500 font-bold">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {form.description.length} characters
                        </span>
                      </div>
                      <textarea
                        value={form.description}
                        onChange={event => { updateForm('description', event.target.value); markTouched('description'); }}
                        onBlur={() => markTouched('description')}
                        rows={4}
                        placeholder={kind === 'product'
                          ? "Detail technical composition, tolerances, certifications (ISO/BIS), standard packaging, and lead time..."
                          : "Describe scope of work, methodology, standard SLAs, deliverables, and engineer qualification..."
                        }
                        className={cn(
                          "w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15",
                          getFieldError('description') && "border-red-500 bg-red-50/30 focus:border-red-500 focus:ring-red-500/20"
                        )}
                      />
                      {getFieldError('description') && (
                        <p className="text-xs text-red-500 font-medium">{getFieldError('description')}</p>
                      )}
                    </div>

                    <div className="sm:col-span-2 pt-1">
                      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 cursor-pointer hover:bg-slate-100/60 transition-colors">
                        <input
                          type="checkbox"
                          checked={Boolean(form.isMsmeMade)}
                          onChange={e => updateForm('isMsmeMade', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 accent-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">MSME / Make in India Verified Offering</span>
                          <span className="text-[11px] text-slate-500 block">Highlights your listing with a verified badge for public procurement preference & subsidies.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ATTRIBUTES & SPECIFICATIONS */}
              {activeTab === 'attributes' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-emerald-600" />
                        Step 2: {kind === 'product' ? 'Product Attributes & Identification' : 'Service Scope & SLA Parameters'}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {kind === 'product'
                          ? 'Provide standard inventory identifiers, HSN codes, and physical conditions.'
                          : 'Define turnaround times, service boundaries, and deliverables.'
                        }
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                      Step 2 of 4
                    </span>
                  </div>

                  {kind === 'product' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        label="Unit of Measure (UOM)"
                        value={form.unitOfMeasure}
                        onChange={event => { updateForm('unitOfMeasure', event.target.value); markTouched('unitOfMeasure'); }}
                        onBlur={() => markTouched('unitOfMeasure')}
                        error={getFieldError('unitOfMeasure')}
                        required
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      >
                        <option value="">Select Unit</option>
                        {QUANTITY_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </Select>

                      <Select
                        label="Item Condition"
                        value={form.itemCondition}
                        onChange={event => { updateForm('itemCondition', event.target.value); markTouched('itemCondition'); }}
                        onBlur={() => markTouched('itemCondition')}
                        error={getFieldError('itemCondition')}
                        required
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      >
                        <option value="">Select Condition</option>
                        {ITEM_CONDITIONS.map(c => <option key={c.value} value={c.label}>{c.label}</option>)}
                      </Select>

                      <Input
                        label="HSN / SAC Code"
                        value={form.hsnCode}
                        onChange={event => { updateForm('hsnCode', event.target.value); markTouched('hsnCode'); }}
                        onBlur={() => markTouched('hsnCode')}
                        error={getFieldError('hsnCode')}
                        required
                        placeholder="e.g. 72142090"
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      />

                      <Input
                        label="SKU / Stock Code"
                        value={form.sku}
                        onChange={e => updateForm('sku', e.target.value)}
                        placeholder="e.g. STL-BM-IS2062-01"
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      />

                      <Input
                        label="Brand / Manufacturer"
                        value={form.brand}
                        onChange={e => updateForm('brand', e.target.value)}
                        placeholder="e.g. Tata Structura / Jindal Steel"
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      />

                      <Input
                        label="Model / Specification Reference"
                        value={form.modelNumber}
                        onChange={e => updateForm('modelNumber', e.target.value)}
                        placeholder="e.g. IS 2062 E250 / ISMB 300"
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      />
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Service Area / Location"
                        value={form.serviceArea}
                        onChange={event => { updateForm('serviceArea', event.target.value); markTouched('serviceArea'); }}
                        onBlur={() => markTouched('serviceArea')}
                        error={getFieldError('serviceArea')}
                        required
                        placeholder="e.g. Delhi NCR, Maharashtra, Pan-India"
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      />

                      <Select
                        label="Pricing Model"
                        value={form.pricingModel}
                        onChange={event => { updateForm('pricingModel', event.target.value); markTouched('pricingModel'); }}
                        onBlur={() => markTouched('pricingModel')}
                        error={getFieldError('pricingModel')}
                        required
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      >
                        <option value="FIXED">Fixed Milestone Rate</option>
                        <option value="HOURLY">Hourly Rate</option>
                        <option value="DAILY">Daily Rate</option>
                        <option value="MONTHLY">Monthly Retainer</option>
                        <option value="PER_PROJECT">Per Project Turnkey</option>
                        <option value="CUSTOM">Custom Rate Contract</option>
                      </Select>

                      <Input
                        label="Project Duration / Lead Time"
                        value={form.duration}
                        onChange={e => { updateForm('duration', e.target.value); markTouched('duration'); }}
                        onBlur={() => markTouched('duration')}
                        error={getFieldError('duration')}
                        required
                        placeholder="e.g. 15 to 30 Business Days"
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      />

                      <Input
                        label="SLA / First Response Time"
                        value={form.slaResponseTime}
                        onChange={e => { updateForm('slaResponseTime', e.target.value); markTouched('slaResponseTime'); }}
                        onBlur={() => markTouched('slaResponseTime')}
                        error={getFieldError('slaResponseTime')}
                        required
                        placeholder="e.g. 4 Hours / Same Day Response"
                        className="bg-slate-50/50 focus:bg-white text-xs h-10"
                      />

                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="block text-[10px] font-bold sm:font-extrabold uppercase tracking-wide text-slate-600 sm:text-[11px]">
                          Scope of Work & Methodology <span className="text-red-500 font-bold">*</span>
                        </label>
                        <textarea
                          value={form.scopeOfWork}
                          onChange={e => { updateForm('scopeOfWork', e.target.value); markTouched('scopeOfWork'); }}
                          onBlur={() => markTouched('scopeOfWork')}
                          rows={3}
                          placeholder="Comprehensive breakdown of project phases, testing protocols, safety compliance, and completion milestones..."
                          className={cn(
                            "w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15",
                            getFieldError('scopeOfWork') && "border-red-500 bg-red-50/30 focus:border-red-500 focus:ring-red-500/20"
                          )}
                        />
                        {getFieldError('scopeOfWork') && (
                          <p className="text-xs text-red-500 font-medium">{getFieldError('scopeOfWork')}</p>
                        )}
                      </div>

                      <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700">Key Deliverables (Optional)</label>
                          <textarea
                            value={form.deliverables}
                            onChange={e => updateForm('deliverables', e.target.value)}
                            rows={3}
                            placeholder="e.g. CAD drawings, engineering audit certificate, test logs..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs focus:bg-white focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700">Inclusions & Tools Provided (Optional)</label>
                          <textarea
                            value={form.inclusions}
                            onChange={e => updateForm('inclusions', e.target.value)}
                            rows={3}
                            placeholder="e.g. On-site engineer, diagnostic kits, transport..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs focus:bg-white focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PRICING, DISCOUNTS & TAXATION */}
              {activeTab === 'pricing' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Tag className="h-4 w-4 text-emerald-600" />
                        Step 3: Commercial Terms, Discounts & GST
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">Configure transparent commercial structures, GST tax schedules, and bulk deals.</p>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                      Step 3 of 4
                    </span>
                  </div>

                  {/* Pricing Inputs */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label={`${kind === 'product' ? 'Base Unit Price' : 'Base Service Rate'} (INR)`}
                      type="number"
                      min="0"
                      step="1"
                      value={kind === 'product' ? form.price : form.basePrice}
                      onChange={event => {
                        updateForm(kind === 'product' ? 'price' : 'basePrice', event.target.value);
                        markTouched(kind === 'product' ? 'price' : 'basePrice');
                      }}
                      onBlur={() => markTouched(kind === 'product' ? 'price' : 'basePrice')}
                      error={getFieldError(kind === 'product' ? 'price' : 'basePrice')}
                      required
                      placeholder="0.00"
                      className="bg-slate-50/50 focus:bg-white text-xs h-10 font-semibold text-slate-900"
                    />

                    <Input
                      label="Standard Catalogue Discount (%)"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={form.discount}
                      onChange={event => updateForm('discount', event.target.value)}
                      placeholder="0 (Optional)"
                      className="bg-slate-50/50 focus:bg-white text-xs h-10"
                    />
                  </div>

                  {/* GST Selector Section */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <Building2 className="h-4 w-4 text-emerald-600" />
                        <span>GST & Tax Compliance Schedule</span>
                        <span className="text-red-500 font-bold">*</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Standard CGST+SGST or Interstate IGST</span>
                    </div>

                    <GstTaxPicker
                      splitRate={form.splitTaxRate}
                      igstRate={form.igstTaxRate}
                      additionalRate={form.otherTaxRate}
                      taxableAmount={taxableAmount}
                      onChange={next => {
                        updateForm('splitTaxRate', next.splitRate);
                        updateForm('igstTaxRate', next.igstRate);
                        updateForm('otherTaxRate', next.additionalRate);
                        markTouched('taxRate');
                      }}
                    />
                    {getFieldError('taxRate') && (
                      <p className="text-xs text-red-500 font-medium">{getFieldError('taxRate')}</p>
                    )}

                    {/* Live Calculation Summary Banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/70 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Base Amount</span>
                        <span className="font-bold text-slate-800">₹{rawPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Discount</span>
                        <span className="font-bold text-emerald-600">-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">GST Tax ({taxBreakdown.totalRate}%)</span>
                        <span className="font-bold text-slate-700">+₹{taxBreakdown.totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">Net Buyer Price</span>
                        <span className="font-bold text-emerald-900 text-sm">₹{(taxableAmount + taxBreakdown.totalTaxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Automated Promotional & Bulk Deals Section */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 space-y-4 shadow-xs">
                    <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-500" />
                          Promotions, Festival Offers & Bulk Quantity Pricing
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Boost listing conversion with automated festival discounts, campaign tags, or volume order tiers.
                        </p>
                      </div>
                    </div>

                    {/* Toggle Cards: Special Offer & Bulk Tier */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Special Offer Card Toggle */}
                      <div
                        onClick={() => {
                          const nextState = !form.isOfferActive;
                          updateForm('isOfferActive', nextState);
                          if (nextState) {
                            const baseVal = kind === 'product' ? form.price : form.basePrice;
                            if (!form.originalPrice && baseVal) {
                              updateForm('originalPrice', baseVal);
                            }
                            if (!form.offerLabel) {
                              updateForm('offerLabel', '🔥 Special Deal');
                            }
                          }
                        }}
                        className={cn(
                          "flex items-start justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                          form.isOfferActive
                            ? "border-amber-400 bg-amber-50/40 ring-1 ring-amber-300/60 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold mt-0.5 shrink-0",
                            form.isOfferActive ? "bg-amber-500 text-white shadow-xs" : "bg-slate-200 text-slate-600"
                          )}>
                            <Tag className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">Limited-Time Promotional Discount</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              Offer temporary MRP discounts, flash deals, or festival campaign rates.
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                          form.isOfferActive ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-slate-200 text-slate-600"
                        )}>
                          {form.isOfferActive ? 'Active' : 'Off'}
                        </span>
                      </div>

                      {/* Bulk Deal Card Toggle */}
                      <div
                        onClick={() => {
                          const nextState = !form.bulkDealAvailable;
                          updateForm('bulkDealAvailable', nextState);
                          if (nextState && !form.bulkMinQuantity) {
                            updateForm('bulkMinQuantity', '10');
                          }
                        }}
                        className={cn(
                          "flex items-start justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                          form.bulkDealAvailable
                            ? "border-emerald-400 bg-emerald-50/40 ring-1 ring-emerald-300/60 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold mt-0.5 shrink-0",
                            form.bulkDealAvailable ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-200 text-slate-600"
                          )}>
                            <Package className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">Bulk Order Volume Tier</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              Highlight volume discounts when buyers order in higher quantities (MOQ).
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                          form.bulkDealAvailable ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-200 text-slate-600"
                        )}>
                          {form.bulkDealAvailable ? 'Active' : 'Off'}
                        </span>
                      </div>
                    </div>

                    {/* Active Promotional Offer Configuration */}
                    {form.isOfferActive && (
                      <div className="rounded-xl border border-amber-200/90 bg-amber-50/30 p-4 space-y-4 animate-in slide-in-from-top-1 duration-200">
                        {/* Baseline Header & Auto-Set Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">Auto Pricing Calculator:</span>{' '}
                            <span className="text-slate-600">
                              Standard Base Price is <strong className="text-slate-900">₹{(kind === 'product' ? toNumber(form.price) : toNumber(form.basePrice)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const baseVal = kind === 'product' ? form.price : form.basePrice;
                              if (baseVal) {
                                updateForm('originalPrice', baseVal);
                                toast.success(`Reference MRP set to base price (₹${baseVal})`);
                              }
                            }}
                            className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-md border border-amber-300/70 cursor-pointer self-start sm:self-auto"
                          >
                            Set MRP = Base Price
                          </button>
                        </div>

                        {/* Automatic 3-Way Pricing Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Original Reference Price / MRP (₹)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={form.originalPrice}
                              onChange={e => {
                                const val = e.target.value;
                                updateForm('originalPrice', val);
                                const orig = parseFloat(val);
                                const promo = parseFloat(form.discountPrice);
                                if (!isNaN(orig) && !isNaN(promo) && orig > promo && orig > 0) {
                                  const pct = Math.round(((orig - promo) / orig) * 100 * 10) / 10;
                                  updateForm('discountPercent', String(pct));
                                }
                              }}
                              placeholder="MRP before discount"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Higher list price (strikethrough)</span>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Discount Percentage (%)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="any"
                              value={form.discountPercent}
                              onChange={e => {
                                const val = e.target.value;
                                updateForm('discountPercent', val);
                                const pct = parseFloat(val);
                                const orig = toNumber(form.originalPrice) || (kind === 'product' ? toNumber(form.price) : toNumber(form.basePrice));
                                if (!isNaN(pct) && orig > 0) {
                                  if (!form.originalPrice) updateForm('originalPrice', String(orig));
                                  const promo = Math.round(orig * (1 - pct / 100) * 100) / 100;
                                  updateForm('discountPrice', String(promo));
                                }
                              }}
                              placeholder="e.g. 20"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Auto-computes offer price</span>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Promotional Offer Price (₹)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={form.discountPrice}
                              onChange={e => {
                                const val = e.target.value;
                                updateForm('discountPrice', val);
                                const promo = parseFloat(val);
                                const orig = toNumber(form.originalPrice) || (kind === 'product' ? toNumber(form.price) : toNumber(form.basePrice));
                                if (!isNaN(promo) && orig > promo && orig > 0) {
                                  if (!form.originalPrice) updateForm('originalPrice', String(orig));
                                  const pct = Math.round(((orig - promo) / orig) * 100 * 10) / 10;
                                  updateForm('discountPercent', String(pct));
                                } else {
                                  updateForm('discountPercent', '');
                                }
                              }}
                              placeholder="Special selling price"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-emerald-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Actual price buyer pays</span>
                          </div>
                        </div>

                        {/* Quick Discount Pill Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Discounts:</span>
                          {[5, 10, 15, 20, 25, 30, 50].map(pct => (
                            <button
                              key={`pct-${pct}`}
                              type="button"
                              onClick={() => {
                                const orig = toNumber(form.originalPrice) || (kind === 'product' ? toNumber(form.price) : toNumber(form.basePrice));
                                if (orig > 0) {
                                  if (!form.originalPrice) updateForm('originalPrice', String(orig));
                                  const promo = Math.round(orig * (1 - pct / 100) * 100) / 100;
                                  updateForm('discountPercent', String(pct));
                                  updateForm('discountPrice', String(promo));
                                } else {
                                  toast.error('Please enter a Base Price or Original Reference Price first.');
                                }
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                                form.discountPercent === String(pct)
                                  ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300"
                              )}
                            >
                              {pct}% OFF
                            </button>
                          ))}
                        </div>

                        {/* Campaign Tag & Presets */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700">
                            Offer Campaign Tag / Badge
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={form.offerLabel}
                              onChange={e => updateForm('offerLabel', e.target.value)}
                              placeholder="e.g. Diwali Fest, Flash Deal, Volume Saver"
                              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                            />
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {['🔥 Festive Deal', '⚡ Flash Sale', '🏷️ Clearance', '🎉 Launch Special', '⭐ MSME Saver'].map(tag => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => updateForm('offerLabel', tag)}
                                  className={cn(
                                    "px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                                    form.offerLabel === tag
                                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                      : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300"
                                  )}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Validity Dates & Quick Durations */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Offer Start Date
                            </label>
                            <input
                              type="date"
                              value={form.offerStartAt}
                              onChange={e => updateForm('offerStartAt', e.target.value)}
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Offer End Date
                            </label>
                            <input
                              type="date"
                              value={form.offerEndAt}
                              onChange={e => updateForm('offerEndAt', e.target.value)}
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                            />
                          </div>
                        </div>

                        {/* Duration Preset Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Validity:</span>
                          {[
                            [7, '7 Days'],
                            [15, '15 Days'],
                            [30, '30 Days'],
                            [60, '60 Days'],
                            [90, '90 Days']
                          ].map(([days, label]) => (
                            <button
                              key={String(days)}
                              type="button"
                              onClick={() => {
                                const start = new Date();
                                const end = new Date();
                                end.setDate(start.getDate() + Number(days));
                                updateForm('offerStartAt', start.toISOString().slice(0, 10));
                                updateForm('offerEndAt', end.toISOString().slice(0, 10));
                              }}
                              className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-amber-50 hover:border-amber-300 cursor-pointer"
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Live Buyer-Facing Offer Badge Preview */}
                        {(form.offerLabel || form.discountPercent || form.discountPrice) && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-amber-500 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                                {form.offerLabel || 'SPECIAL OFFER'}
                              </span>
                              {form.discountPercent && (
                                <span className="bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                                  {form.discountPercent}% OFF
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-800">
                              {form.originalPrice && form.discountPrice && (
                                <span>
                                  MRP: <span className="line-through text-slate-400">₹{toNumber(form.originalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  {' '}→{' '}
                                  <strong className="text-emerald-900 text-sm font-black">
                                    ₹{toNumber(form.discountPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </strong>
                                  <span className="text-emerald-700 text-[11px] ml-1 font-semibold">
                                    (Save ₹{(toNumber(form.originalPrice) - toNumber(form.discountPrice)).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Active Bulk Deal Configuration */}
                    {form.bulkDealAvailable && (
                      <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/30 p-4 space-y-3 animate-in slide-in-from-top-1 duration-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="text-xs font-bold text-slate-800">
                            Minimum Order Quantity for Bulk Rates (MOQ)
                          </label>
                          <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                            Tier-Based Deal Enabled
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          <div className="relative w-full sm:w-64">
                            <input
                              type="number"
                              min="1"
                              value={form.bulkMinQuantity}
                              onChange={e => updateForm('bulkMinQuantity', e.target.value)}
                              placeholder="e.g. 10"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-16 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                              {kind === 'product' ? (form.unitOfMeasure || 'Units') : 'Milestones'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick MOQ:</span>
                            {['5', '10', '25', '50', '100', '500'].map(moq => (
                              <button
                                key={moq}
                                type="button"
                                onClick={() => updateForm('bulkMinQuantity', moq)}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                                  form.bulkMinQuantity === moq
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300"
                                )}
                              >
                                {moq}+
                              </button>
                            ))}
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500">
                          Buyers purchasing <strong className="text-slate-800">{form.bulkMinQuantity || '10'}+ {kind === 'product' ? (form.unitOfMeasure || 'units') : 'hours/milestones'}</strong> will see the Volume Deal badge on your marketplace card and can initiate bulk procurement orders.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: SPECIFICATIONS, MEDIA & DOCUMENTS */}
              {activeTab === 'specs' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-emerald-600" />
                        Step 4: Media, Technical Specs & Compliance Files
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">Upload high-resolution media, dynamic key-value parameters, and datasheets.</p>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                      Step 4 of 4
                    </span>
                  </div>

                  {/* Image Upload Manager */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ImageIcon className="h-4 w-4 text-emerald-600" />
                        {kind === 'product' ? 'Product Photos & Gallery' : 'Service Showcase Images'}
                        <span className="text-red-500 font-bold">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {uploadedImages.length} image{uploadedImages.length !== 1 ? 's' : ''} uploaded (At least 1 required)
                      </span>
                    </div>

                    {/* Thumbnail Grid */}
                    {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                        {uploadedImages.map((img, idx) => (
                          <div
                            key={img.id}
                            className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs"
                          >
                            <img
                              src={img.localUrl || getCatalogueImageUrl(img.id)}
                              alt={img.originalName || `Upload ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                            {idx === 0 && (
                              <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-xs">
                                Primary
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    setPreviewDocument(await getFileAssetPreview({
                                      id: img.id,
                                      fileId: img.id,
                                      url: img.localUrl || getCatalogueImageUrl(img.id),
                                      originalName: img.originalName,
                                      mimeType: img.mimeType || 'image/png'
                                    }, img.originalName));
                                  } catch (err) {
                                    toast.error('Unable to preview image');
                                  }
                                }}
                                className="h-7 w-7 rounded-lg bg-white/90 text-slate-900 flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                                title="View Image"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeUploadedFile(img.id, 'image')}
                                className="h-7 w-7 rounded-lg bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors cursor-pointer"
                                title="Delete Image"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Drag and Drop Zone */}
                    <label className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-5 cursor-pointer transition-all duration-150",
                      getFieldError('images')
                        ? "border-red-400 bg-red-50/20 hover:bg-red-50/30"
                        : "border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/20"
                    )}>
                      <Upload className={cn("h-6 w-6 mb-1.5", getFieldError('images') ? "text-red-400" : "text-slate-400")} />
                      <span className="text-xs font-bold text-slate-700">Click to upload or drag & drop</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP up to 10MB each</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploading}
                        onChange={(e) => handleFileUpload(e, 'image')}
                        className="hidden"
                      />
                    </label>
                    {getFieldError('images') && (
                      <p className="text-xs text-red-500 font-medium">{getFieldError('images')}</p>
                    )}
                  </div>

                  {/* Technical Specifications Key-Value Editor */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                          Technical Specifications (Key-Value)
                        </h3>
                        <p className="text-[11px] text-slate-500">Add granular technical parameters such as Tensile Strength, Grade, Dimensions, or SLA.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSpecifications(prev => [...prev, { name: '', value: '', unit: '' }])}
                        className="h-8 text-xs font-bold border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Row
                      </Button>
                    </div>

                    {specifications.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                        <p className="text-xs text-slate-500">No specifications added yet. Click &quot;Add Row&quot; to define custom parameters.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {specifications.map((spec, index) => (
                          <div key={index} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <div className="flex-1">
                              <Input
                                value={spec.name}
                                onChange={e => setSpecifications(prev => prev.map((row, i) => i === index ? { ...row, name: e.target.value } : row))}
                                placeholder="Property (e.g. Yield Strength)"
                                className="bg-white text-xs h-8"
                              />
                            </div>
                            <div className="flex-1">
                              <Input
                                value={spec.value}
                                onChange={e => setSpecifications(prev => prev.map((row, i) => i === index ? { ...row, value: e.target.value } : row))}
                                placeholder="Value (e.g. 250)"
                                className="bg-white text-xs h-8"
                              />
                            </div>
                            {/* <div className="w-24">
                              <Input
                                value={spec.unit}
                                onChange={e => setSpecifications(prev => prev.map((row, i) => i === index ? { ...row, unit: e.target.value } : row))}
                                placeholder="Unit (e.g. MPa)"
                                className="bg-white text-xs h-8"
                              />
                            </div> */}
                            <button
                              type="button"
                              onClick={() => setSpecifications(prev => prev.filter((_, i) => i !== index))}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors border border-transparent hover:border-red-200 cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Specification Documents & Test Reports */}
                  <div className="space-y-3 pt-2">
                    <div className="border-t border-slate-100 pt-4">
                      <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        Specification Sheets & Compliance Documents (Optional)
                      </h3>
                      <p className="text-[11px] text-slate-500">Upload PDF brochures, ISO/BIS certificates, or technical drawings for buyers.</p>
                    </div>

                    {uploadedDocuments.length > 0 && (
                      <div className="space-y-2">
                        {uploadedDocuments.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-white">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <FileText className="h-4 w-4" />
                              </div>
                              <span className="text-xs font-semibold text-slate-800 truncate">{doc.originalName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    setPreviewDocument(await getFileAssetPreview({
                                      id: doc.id,
                                      fileId: doc.id,
                                      url: doc.localUrl || getCatalogueImageUrl(doc.id),
                                      originalName: doc.originalName,
                                      mimeType: doc.mimeType
                                    }, doc.originalName));
                                  } catch (err) {
                                    toast.error('Unable to view document');
                                  }
                                }}
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                                title="View Document"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeUploadedFile(doc.id, 'document')}
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 cursor-pointer"
                                title="Delete Document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-100/50 cursor-pointer transition-colors text-xs font-semibold text-slate-600">
                      <FileUp className="h-4 w-4 text-slate-400" />
                      <span>Upload PDF / DOCX Datasheet</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                        multiple
                        disabled={uploading}
                        onChange={(e) => handleFileUpload(e, 'document')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Notice Alert if submit was attempted with missing info */}
          {!isAllValid && attemptedSubmit && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Please complete missing required fields ({[
                  !isStep1Valid && 'Step 1: General Info',
                  !isStep2Valid && (kind === 'product' ? 'Step 2: Attributes' : 'Step 2: SLA & Scope'),
                  !isStep3Valid && 'Step 3: Pricing & Tax',
                  !isStep4Valid && 'Step 4: Image Upload'
                ].filter(Boolean).join(', ')}).
              </span>
            </div>
          )}

          {/* Form Actions Toolbar */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div>
              {activeTab !== 'basic' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (activeTab === 'attributes') setActiveTab('basic');
                    if (activeTab === 'pricing') setActiveTab('attributes');
                    if (activeTab === 'specs') setActiveTab('pricing');
                  }}
                  className="h-9 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 px-4 cursor-pointer"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Previous
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-9 rounded-xl text-xs font-semibold border-slate-200 text-slate-600 hover:bg-slate-50 px-4 cursor-pointer"
                >
                  Cancel
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeTab !== 'specs' ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'basic') setActiveTab('attributes');
                    if (activeTab === 'attributes') setActiveTab('pricing');
                    if (activeTab === 'pricing') setActiveTab('specs');
                  }}
                  className="h-9 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs px-5 cursor-pointer"
                >
                  Next Step <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!isAllValid || saving || uploading}
                  className={cn(
                    "h-9 rounded-xl text-xs font-bold text-white shadow-sm px-6 transition-all cursor-pointer",
                    kind === 'product' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#12335f] hover:bg-[#0e274a]",
                    (!isAllValid || saving || uploading) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      {isEdit ? 'Save Changes' : `Publish ${kind === 'product' ? 'Product' : 'Service'}`}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Marketplace Card & Readiness Checklist (Span 4) */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
          {/* Live Preview Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Live Marketplace Card
              </span>
              <Badge className={kind === 'product' ? 'bg-emerald-600 text-white text-[9px]' : 'bg-[#12335f] text-white text-[9px]'}>
                {kind.toUpperCase()}
              </Badge>
            </div>

            {/* Visual Thumbnail */}
            <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden group">
              {uploadedImages.length > 0 ? (
                <img
                  src={uploadedImages[0].localUrl || getCatalogueImageUrl(uploadedImages[0].id)}
                  alt="Marketplace Listing Primary"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                  <ImageIcon className="h-8 w-8 text-slate-300 mb-1" />
                  <span className="text-[11px] font-semibold text-slate-400">Preview image updates live</span>
                </div>
              )}
              {form.isMsmeMade && (
                <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs border border-emerald-100 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> MSME Made
                </div>
              )}
            </div>

            {/* Details Content */}
            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>{form.brand || 'Enterprise Supplier'}</span>
                  {selectedCategory && (
                    <>
                      <span>•</span>
                      <span className="text-slate-600 truncate">{selectedCategory.name}</span>
                    </>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2 leading-snug">
                  {form.name || 'Untitled Marketplace Offering'}
                </h3>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                  {form.description || 'Listing description will appear here on the buyer catalogue...'}
                </p>
              </div>

              {/* Attributes Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {kind === 'product' ? (
                  <>
                    {form.unitOfMeasure && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                        Unit: {form.unitOfMeasure}
                      </span>
                    )}
                    {form.itemCondition && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                        {form.itemCondition}
                      </span>
                    )}
                    {form.hsnCode && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                        HSN: {form.hsnCode}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {form.serviceArea && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> {form.serviceArea}
                      </span>
                    )}
                    {form.slaResponseTime && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> {form.slaResponseTime}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Commercials Box */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Base Price:</span>
                  <span className="font-semibold text-slate-700">₹{rawPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600">
                    <span>Discount ({form.discount}%):</span>
                    <span className="font-semibold">-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {taxBreakdown.totalTaxAmount > 0 && (
                  <div className="flex items-center justify-between text-slate-500">
                    <span>GST Tax ({taxBreakdown.totalRate}%):</span>
                    <span className="font-semibold text-slate-700">+₹{taxBreakdown.totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="border-t border-slate-200/80 pt-1.5 flex items-center justify-between">
                  <span className="font-bold text-slate-900">Total Price:</span>
                  <span className="font-extrabold text-emerald-700 text-sm">
                    ₹{(taxableAmount + taxBreakdown.totalTaxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Publication Readiness Meter */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Catalogue Readiness</span>
              <span className="text-xs font-extrabold text-emerald-600">{completionPercentage}%</span>
            </div>

            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 text-xs">
                <div className={cn("h-4 w-4 rounded-full flex items-center justify-center text-[10px]", isStep1Valid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                  {isStep1Valid ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : '1'}
                </div>
                <span className={isStep1Valid ? "text-slate-800 font-semibold" : "text-slate-500"}>Basic information & category</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className={cn("h-4 w-4 rounded-full flex items-center justify-center text-[10px]", isStep2Valid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                  {isStep2Valid ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : '2'}
                </div>
                <span className={isStep2Valid ? "text-slate-800 font-semibold" : "text-slate-500"}>{kind === 'product' ? 'Attributes & HSN' : 'SLA & Scope'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className={cn("h-4 w-4 rounded-full flex items-center justify-center text-[10px]", isStep3Valid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                  {isStep3Valid ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : '3'}
                </div>
                <span className={isStep3Valid ? "text-slate-800 font-semibold" : "text-slate-500"}>Pricing & GST schedule</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className={cn("h-4 w-4 rounded-full flex items-center justify-center text-[10px]", isStep4Valid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                  {isStep4Valid ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : '4'}
                </div>
                <span className={isStep4Valid ? "text-slate-800 font-semibold" : "text-slate-500"}>Primary media photo uploaded</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      <DocumentPreviewModal previewDocument={previewDocument} onClose={() => setPreviewDocument(null)} />
    </div>
  );
}
