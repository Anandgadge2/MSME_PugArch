import { FormEvent, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, IndianRupee, PackagePlus, PackageSearch, Plus, RefreshCw, Search, Settings2, Store, Wrench, Grid, List, Eye, ShoppingCart, X, Globe, Tag, Barcode, Info, FileText, Mail, MapPin, ShieldCheck, CalendarDays, Building2, Upload, Trash2, FileUp, ImageIcon, Paperclip, ArrowUp, ArrowDown, ArrowUpDown, Download, Copy, ToggleLeft, ToggleRight } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input, Select } from '../../../components/ui/input';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../lib/utils';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { getApi, normalizeList, postApi } from '../../shared/apiClient';
import { formatCurrency, formatDateTime } from '../../shared/format';
import { KpiCard } from '../../shared/KpiCard';
import { Pagination } from '../../shared/Pagination';
import { usePagination, useResponsiveViewMode } from '../../shared/hooks';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import type { CatalogueItemDto, CategoryDto } from '../../shared/types';
import { GstTaxPicker, calculateGstBreakdown } from '../../shared/gstTax';
import { catalogueApi, downloadCatalogueFile } from '../api';
import { getFileAssetPreview, type DocumentPreview, openFileAsset } from '../../../lib/files';
import { DocumentPreviewModal } from '../../../components/DocumentPreviewModal';
import { QUANTITY_UNITS, ITEM_CONDITIONS } from '../../../constants/dropdowns';
import { api, BASE_URL } from '../../../lib/api';
import { compressImage } from '../../../lib/compress';
import { useDebounce } from '../../../hooks/useDebounce';
import { CompareToggleButton } from '../../marketplace/components/CompareToggleButton';
import { CompareTray } from '../../marketplace/components/CompareTray';
import { resolveMarketplaceImage } from '../../marketplace/utils/marketplaceImages';
import { CatalogueImportModal } from '../components/CatalogueImportModal';
import type { ImportBatchDto } from '../api';

type CatalogueMode = 'buyer' | 'seller' | 'admin';
type ItemKind = 'product' | 'service';
type FilterKind = 'all' | ItemKind;
type CatalogueRecord = CatalogueItemDto & { itemKind: ItemKind };
type BuyerActionState = {
  purchase?: { id?: number; status?: string; purchaseNumber?: string };
  rfq?: { id?: number; status?: string; subject?: string };
};

const blankForm = {
  name: '',
  description: '',
  price: '',
  splitTaxRate: '',
  igstTaxRate: '0.00',
  otherTaxRate: '',
  discount: '0.00',
  hsnCode: '',
  unitOfMeasure: '',
  itemCondition: '',
  basePrice: '',
  pricingModel: 'FIXED',
  serviceArea: '',
  status: 'ACTIVE',
  categoryId: ''
};

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

const cataloguePrice = (item: CatalogueRecord) =>
  item.itemKind === 'product' ? toNumber(item.price) : toNumber(item.basePrice);

const actionKey = (sellerId: unknown) => String(sellerId || '');

const getCatalogueImageUrl = (fileId: number | string | undefined) => {
  if (!fileId) return '';
  const token = localStorage.getItem('token') || '';
  return `${BASE_URL}/api/files/${fileId}/view?token=${encodeURIComponent(token)}`;
};

type CatalogueMedia = {
  id?: number;
  label: string;
  fileId?: number;
  mimeType?: string;
  originalName?: string;
  kind: 'image' | 'document';
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

const mediaToUploadedAsset = (media: CatalogueMedia) => ({
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

const catalogueMedia = (item: CatalogueRecord) => {
  const media: CatalogueMedia[] = [];

  item.images?.forEach((image, index) => {
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

  item.certifications?.forEach((cert, index) => {
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

  item.catalogueFiles?.forEach((file, index) => {
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

const getItemImageId = (item: CatalogueRecord): number | null =>
  catalogueMedia(item).find(file => file.kind === 'image')?.fileId || null;

const getCatalogueImageSrc = (item: CatalogueRecord) => {
  const marketplaceImage = resolveMarketplaceImage(item, item.itemKind);
  if (marketplaceImage) return marketplaceImage;
  const directUrl = String((item as any).imageUrl || '').trim();
  if (directUrl) return directUrl;
  const mediaImage = catalogueMedia(item).find(file => file.kind === 'image');
  const nestedUrl = String((mediaImage as any)?.url || (mediaImage as any)?.fileUrl || '').trim();
  if (nestedUrl) return nestedUrl;
  const image = item.images?.find(entry => entry.fileAsset?.url || entry.fileAssetId || entry.fileAsset?.id);
  const imageUrl = String(image?.fileAsset?.url || '').trim();
  if (imageUrl) return imageUrl;
  const fileId = mediaImage?.fileId || getItemImageId(item);
  return fileId ? getCatalogueImageUrl(fileId) : '';
};

const catalogueDocuments = (item: CatalogueRecord) =>
  catalogueMedia(item).filter(file => file.kind === 'document');

const isProcurementApproved = (status?: string) =>
  ['approved_for_procurement', 'approved'].includes(String(status || ''));

export default function CataloguePage({ mode = 'buyer' }: { mode?: CatalogueMode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<CatalogueRecord[]>([]);
  const [services, setServices] = useState<CatalogueRecord[]>([]);
  const [categoryList, setCategoryList] = useState<CategoryDto[]>([]);
  const [editingItem, setEditingItem] = useState<CatalogueRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<FilterKind>('all');
  const [formKind, setFormKind] = useState<ItemKind>('product');
  const [form, setForm] = useState(blankForm);
  const [showForm, setShowForm] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Layout and modal states
  const [viewMode, setViewMode] = useResponsiveViewMode();
  const [sortKey, setSortKey] = useState<'sr' | 'name' | 'kind' | 'category' | 'seller' | 'price' | 'status' | 'hsn' | 'createdAt'>('sr');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<CatalogueRecord | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreview | null>(null);
  const [selectedPurchaseItem, setSelectedPurchaseItem] = useState<CatalogueRecord | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [addingItemKey, setAddingItemKey] = useState<string | null>(null);
  const [buyerActions, setBuyerActions] = useState<Record<string, BuyerActionState>>({});
  const [importKind, setImportKind] = useState<'product' | 'service' | null>(null);
  const [importHistory, setImportHistory] = useState<ImportBatchDto[]>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  // File upload state for catalogue form
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

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

  const removeUploadedFile = (id: number, type: 'image' | 'document') => {
    if (type === 'image') {
      const removed = uploadedImages.find(img => img.id === id);
      if (removed?.localUrl) URL.revokeObjectURL(removed.localUrl);
      setUploadedImages(prev => prev.filter(img => img.id !== id));
    } else {
      const removed = uploadedDocuments.find(doc => doc.id === id);
      if (removed?.localUrl) URL.revokeObjectURL(removed.localUrl);
      setUploadedDocuments(prev => prev.filter(doc => doc.id !== id));
    }
  };

  const sellerApproved = mode !== 'seller' || isProcurementApproved(user?.onboardingStatus);
  const buyerApproved = mode !== 'buyer' || isProcurementApproved(user?.onboardingStatus);
  const buyerProcurementLocked = mode === 'buyer' && !buyerApproved;

  const productsRef = useRef<CatalogueRecord[]>([]);
  productsRef.current = products;
  const servicesRef = useRef<CatalogueRecord[]>([]);
  servicesRef.current = services;

  const loadBuyerActions = useCallback(async (allProducts?: CatalogueRecord[], allServices?: CatalogueRecord[]) => {
    if (mode !== 'buyer') return;
    try {
      const [purchaseRows, rfqRows] = await Promise.all([
        getApi('/api/direct-purchases').catch(() => []),
        getApi('/api/quote-requests').catch(() => [])
      ]);
      const next: Record<string, BuyerActionState> = {};
      const currentProducts = allProducts || productsRef.current;
      const currentServices = allServices || servicesRef.current;
      const allItems = [...currentProducts, ...currentServices];

      normalizeList<any>(purchaseRows).forEach(row => {
        let matchedItem: CatalogueRecord | undefined = undefined;

        // A. Match by requirement item productId or name
        if (row.requirement?.items?.length) {
          const reqItem = row.requirement.items[0];
          matchedItem = allItems.find(item =>
            (reqItem.productId && item.id === reqItem.productId) ||
            item.name.toLowerCase() === reqItem.itemName.toLowerCase()
          );
        }

        // B. Match by requirement title containing item name
        if (!matchedItem && row.requirement?.title) {
          matchedItem = allItems.find(item =>
            row.requirement.title.includes(item.name)
          );
        }

        // C. Fallback: If requirement is null, check if totalAmount matches the item price
        if (!matchedItem && row.totalAmount && Number(row.totalAmount) > 0) {
          matchedItem = allItems.find(item => {
            const price = item.itemKind === 'product' ? toNumber(item.price) : toNumber(item.basePrice);
            return price === Number(row.totalAmount);
          });
        }

        if (matchedItem) {
          const key = `${matchedItem.itemKind}-${matchedItem.id}`;
          next[key] = {
            ...next[key],
            purchase: {
              id: row.id,
              status: row.status,
              purchaseNumber: row.purchaseNumber
            }
          };
        }
      });

      normalizeList<any>(rfqRows).forEach(row => {
        const matchedItem = allItems.find(item =>
          (row.subject && row.subject.includes(item.name)) ||
          (row.message && row.message.includes(item.name))
        );

        if (matchedItem) {
          const key = `${matchedItem.itemKind}-${matchedItem.id}`;
          next[key] = {
            ...next[key],
            rfq: {
              id: row.id,
              status: row.status || row.statusEnum,
              subject: row.subject
            }
          };
        }
      });

      setBuyerActions(next);
    } catch {
      // Marketplace should still render even if activity status cannot be fetched.
    }
  }, [mode]);

  const loadCatalogue = useCallback(async (skipCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const [productRows, serviceRows, categoriesData] = await Promise.all([
        mode === 'seller'
          ? catalogueApi.sellerProducts(skipCache)
          : mode === 'admin'
            ? catalogueApi.adminProducts({}, skipCache)
            : catalogueApi.searchProducts({}, skipCache),
        mode === 'seller'
          ? catalogueApi.sellerServices(skipCache)
          : mode === 'admin'
            ? catalogueApi.adminServices({}, skipCache)
            : catalogueApi.searchServices({}, skipCache),
        catalogueApi.categories()
      ]);
      let normProducts = normalizeList<CatalogueItemDto>(productRows).map(item => ({ ...item, itemKind: 'product' as const }));
      let normServices = normalizeList<CatalogueItemDto>(serviceRows).map(item => ({ ...item, itemKind: 'service' as const }));
      if (mode === 'seller' && user) {
        normProducts = normProducts.filter(item => Number(item.sellerId || item.seller?.id) === Number(user.id));
        normServices = normServices.filter(item => Number(item.sellerId || item.seller?.id) === Number(user.id));
      }
      setProducts(normProducts);
      setServices(normServices);
      setCategoryList(categoriesData || []);
      void loadBuyerActions(normProducts, normServices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load marketplace');
    } finally {
      setLoading(false);
    }
  }, [loadBuyerActions, mode, user]);

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const loadImportHistory = useCallback(async (skipCache = false) => {
    if (mode !== 'seller') return;
    try {
      const rows = await catalogueApi.importHistory(skipCache);
      setImportHistory(normalizeList<ImportBatchDto>(rows));
    } catch {
      // non-blocking
    }
  }, [mode]);

  useEffect(() => {
    void loadImportHistory();
  }, [loadImportHistory]);

  const openViewDetails = async (item: CatalogueRecord) => {
    try {
      const full = item.itemKind === 'product'
        ? await catalogueApi.getProduct(item.id)
        : await catalogueApi.getService(item.id);
      setSelectedDetailsItem({ ...full, itemKind: item.itemKind });
    } catch {
      setSelectedDetailsItem(item);
    }
  };

  const duplicateItem = async (item: CatalogueRecord) => {
    try {
      if (item.itemKind === 'product') await catalogueApi.duplicateProduct(item.id);
      else await catalogueApi.duplicateService(item.id);
      toast.success(`${item.itemKind === 'product' ? 'Product' : 'Service'} duplicated as draft`);
      await loadCatalogue(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Duplicate failed');
    }
  };

  const togglePublish = async (item: CatalogueRecord) => {
    const next = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      if (item.itemKind === 'product') await catalogueApi.setProductStatus(item.id, next);
      else await catalogueApi.setServiceStatus(item.id, next);
      toast.success(next === 'ACTIVE' ? 'Published to marketplace' : 'Deactivated');
      await loadCatalogue(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  useEffect(() => {
    return () => {
      if (previewDocument?.url?.startsWith('blob:')) URL.revokeObjectURL(previewDocument.url);
    };
  }, [previewDocument?.url]);

  const data = useMemo(() => [...products, ...services], [products, services]);
  const categories = useMemo(() => Array.from(new Set(data.map(item => item.category?.name).filter(Boolean) as string[])).sort(), [data]);
  const statuses = useMemo(() => Array.from(new Set(data.map(item => item.status).filter(Boolean) as string[])).sort(), [data]);

  const filtered = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    return data.filter(item => {
      const price = cataloguePrice(item);
      const haystack = [item.name, item.description, item.category?.name, item.seller?.name, item.seller?.email, item.itemKind].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesKind = kindFilter === 'all' || item.itemKind === kindFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;
      const matchesCategory = !categoryFilter || item.category?.name === categoryFilter;
      const matchesPrice = !priceFilter || (priceFilter === 'high' ? price >= 10000 : priceFilter === 'mid' ? price >= 1000 && price < 10000 : price < 1000);
      const sellerStatus = String(item.seller?.onboardingStatus || '').toLowerCase();
      const matchesVerification = !verificationFilter ||
        (verificationFilter === 'verified' ? isProcurementApproved(sellerStatus) : !isProcurementApproved(sellerStatus));
      return matchesSearch && matchesKind && matchesStatus && matchesCategory && matchesPrice && matchesVerification;
    });
  }, [categoryFilter, data, debouncedSearchTerm, kindFilter, priceFilter, statusFilter, verificationFilter]);

  const sorted = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const valueOf = (item: CatalogueRecord): number | string => {
      if (sortKey === 'name') return (item.name || '').toLowerCase();
      if (sortKey === 'kind') return item.itemKind || '';
      if (sortKey === 'category') return (item.category?.name || '').toLowerCase();
      if (sortKey === 'seller') return (item.seller?.name || '').toLowerCase();
      if (sortKey === 'price') return cataloguePrice(item);
      if (sortKey === 'status') return (item.status || '').toLowerCase();
      if (sortKey === 'hsn') return (item.hsnCode || '').toLowerCase();
      if (sortKey === 'createdAt') return item.createdAt ? new Date(item.createdAt).getTime() : 0;
      return Number(item.id || 0);
    };
    return [...filtered].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      return String(av).localeCompare(String(bv)) * direction;
    });
  }, [filtered, sortKey, sortDirection]);

  const { page, pageSize, pageItems: pagedItems, total, setPage, setPageSize } = usePagination(sorted, 10);

  const averageValue = filtered.length ? filtered.reduce((sum, item) => sum + cataloguePrice(item), 0) / filtered.length : 0;

  const updateForm = (field: keyof typeof blankForm, value: string) => setForm(current => ({ ...current, [field]: value }));

  const openCreateForm = (kind: ItemKind) => {
    setEditingItem(null);
    setFormKind(kind);
    setShowForm(true);
    setForm(blankForm);
    setUploadedImages([]);
    setUploadedDocuments([]);
  };

  const openEditForm = (item: CatalogueRecord) => {
    setEditingItem(item);
    setFormKind(item.itemKind);
    setForm({
      name: item.name || '',
      description: item.description || '',
      price: item.price === null || item.price === undefined ? '' : String(item.price),
      splitTaxRate: '',
      igstTaxRate: item.taxRate === null || item.taxRate === undefined ? '0.00' : String(item.taxRate),
      otherTaxRate: '',
      discount: item.discount === null || item.discount === undefined ? '0.00' : String(item.discount),
      hsnCode: item.hsnCode || '',
      unitOfMeasure: item.unitOfMeasure || '',
      itemCondition: item.itemCondition || '',
      basePrice: item.basePrice === null || item.basePrice === undefined ? '' : String(item.basePrice),
      pricingModel: item.pricingModel || 'FIXED',
      serviceArea: item.serviceArea || '',
      status: item.status || 'ACTIVE',
      categoryId: String(item.categoryId || '')
    });
    const media = catalogueMedia(item);
    const mediaToAsset = (m: any) => ({
      id: m.fileId,
      fileId: m.fileId,
      fileAssetId: m.fileId,
      originalName: m.originalName || m.label,
      mimeType: m.mimeType
    });
    setUploadedImages(media.filter(file => file.kind === 'image').map(mediaToAsset));
    setUploadedDocuments(media.filter(file => file.kind === 'document').map(mediaToAsset));
    setShowForm(true);
  };

  const openSellerProfile = async (seller: CatalogueRecord['seller']) => {
    const sellerId = seller?.id;
    if (!sellerId) return;
    setSellerLoading(true);
    setSelectedSeller({ id: sellerId, name: seller?.name, email: seller?.email });
    try {
      const profile = await getApi(`/api/sellers/${sellerId}`);
      setSelectedSeller(profile);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open seller profile');
    } finally {
      setSellerLoading(false);
    }
  };

  const updateBuyerAction = (item: CatalogueRecord, action: BuyerActionState) => {
    const key = `${item.itemKind}-${item.id}`;
    setBuyerActions(current => ({ ...current, [key]: { ...current[key], ...action } }));
  };

  const openPurchaseBid = (item: CatalogueRecord) => {
    if (buyerProcurementLocked) {
      toast.error('Your buyer account must be approved by admin before purchase or RFQ actions are allowed.');
      return;
    }
    setSelectedPurchaseItem(item);
  };

  const handleAddToCart = async (item: CatalogueRecord) => {
    if (buyerProcurementLocked) {
      toast.error('Your buyer account must be approved by admin before purchase or RFQ actions are allowed.');
      return;
    }
    const itemKey = `${item.itemKind}-${item.id}`;
    setAddingItemKey(itemKey);
    try {
      const payload = item.itemKind === 'product'
        ? { productId: item.id, quantity: 1 }
        : { serviceId: item.id, quantity: 1 };
      await postApi('/api/cart/items', payload);
      toast.success(`${item.name} added to cart`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add to cart');
    } finally {
      setAddingItemKey(null);
    }
  };

  const deleteItem = async (item: CatalogueRecord) => {
    if (!window.confirm(`Are you sure you want to delete this ${item.itemKind}?`)) {
      return;
    }
    setLoading(true);
    try {
      if (item.itemKind === 'product') {
        await catalogueApi.deleteProduct(item.id);
      } else {
        await catalogueApi.deleteService(item.id);
      }
      toast.success(`${item.itemKind === 'product' ? 'Product' : 'Service'} deleted successfully.`);
      await loadCatalogue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete marketplace item');
    } finally {
      setLoading(false);
    }
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!sellerApproved) {
      toast.error('Your seller account must be approved before adding marketplace items.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Enter an item name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        status: form.status,
        currency: 'INR',
        imageIds: uploadedAssetIds(uploadedImages),
        documentIds: uploadedAssetIds(uploadedDocuments),
        ...(formKind === 'product'
          ? {
            price: form.price ? Number(form.price) : null,
            taxRate: (form.splitTaxRate ? Number(form.splitTaxRate) : 0) + (form.igstTaxRate ? Number(form.igstTaxRate) : 0) + (form.otherTaxRate ? Number(form.otherTaxRate) : 0),
            discount: form.discount ? Number(form.discount) : 0,
            hsnCode: form.hsnCode.trim() || null,
            unitOfMeasure: form.unitOfMeasure.trim() || null,
            itemCondition: form.itemCondition.trim() || null
          }
          : {
            basePrice: form.basePrice ? Number(form.basePrice) : null,
            taxRate: (form.splitTaxRate ? Number(form.splitTaxRate) : 0) + (form.igstTaxRate ? Number(form.igstTaxRate) : 0) + (form.otherTaxRate ? Number(form.otherTaxRate) : 0),
            discount: form.discount ? Number(form.discount) : 0,
            pricingModel: form.pricingModel,
            serviceArea: form.serviceArea.trim() || null
          })
      };

      if (editingItem) {
        if (formKind === 'product') {
          await catalogueApi.updateProduct(editingItem.id, payload);
          toast.success('Product updated successfully.');
        } else {
          await catalogueApi.updateService(editingItem.id, payload);
          toast.success('Service updated successfully.');
        }
      } else {
        if (formKind === 'product') {
          await catalogueApi.createProduct(payload);
          toast.success('Product added to your marketplace.');
        } else {
          await catalogueApi.createService(payload);
          toast.success('Service added to your marketplace.');
        }
      }
      uploadedImages.forEach(img => { if (img.localUrl) URL.revokeObjectURL(img.localUrl); });
      uploadedDocuments.forEach(doc => { if (doc.localUrl) URL.revokeObjectURL(doc.localUrl); });
      setUploadedImages([]);
      setUploadedDocuments([]);
      setShowForm(false);
      setEditingItem(null);
      setForm(blankForm);
      await loadCatalogue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save marketplace item');
    } finally {
      setSaving(false);
    }
  };

  // const title = mode === 'seller' ? 'Seller Marketplace' : mode === 'admin' ? 'Marketplace Review' : 'Buyer Marketplace';
  const subtitle = mode === 'seller'
    ? 'Create and manage products and services after seller approval.'
    : mode === 'admin'
      ? 'Review every product and service listed by sellers.'
      : 'Search approved products and services from active sellers.';

  const isInitialLoading = loading && data.length === 0;

  return (
    <div className="min-w-0 space-y-6">
      {/* Premium Dashboard Banner Header */}
      <div className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_18%_18%,#1f6f63_0,#12335f_46%,#07172e_100%)] px-6 py-4 lg:py-3.5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between relative z-10">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Marketplace Catalogue</h1>
            <p className="mt-0.5 max-w-3xl text-xs font-semibold leading-relaxed text-blue-100/90">{subtitle}</p>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            {mode === 'seller' && (
              <>
                <Button disabled={!sellerApproved} onClick={() => router.push('/seller/products/new')} className="h-10 rounded-2xl bg-emerald-500 px-4 text-xs font-black uppercase tracking-wider text-white shadow-md border-0 hover:bg-emerald-400">
                  <PackagePlus className="mr-2 h-4 w-4" /> Add Product
                </Button>
                <Button disabled={!sellerApproved} onClick={() => router.push('/seller/services/new')} className="h-10 rounded-2xl border border-white/20 bg-white/10 px-4 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-white/15">
                  <Wrench className="mr-2 h-4 w-4" /> Add Service
                </Button>
                <Button disabled={!sellerApproved} variant="outline" onClick={() => setImportKind('product')} className="h-10 rounded-2xl border-white/20 bg-white/10 text-xs font-black uppercase tracking-wider text-white hover:bg-white/15">
                  <FileUp className="mr-2 h-4 w-4" /> Import
                </Button>
                <Button disabled={!sellerApproved} variant="outline" onClick={() => {
                  downloadCatalogueFile('/api/catalogue/import/templates/products', 'catalogue_products_template.xlsx')
                    .catch(() => toast.error('Template download failed'));
                }} className="h-10 rounded-2xl border-white/20 bg-white/10 text-xs font-black uppercase tracking-wider text-white hover:bg-white/15" title="Download Product Template">
                  <Download className="mr-2 h-4 w-4" /> Template
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => loadCatalogue(true)} className="h-10 rounded-2xl border-white/20 bg-white/10 text-xs font-black uppercase tracking-wider text-white hover:bg-white/15">
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {mode === 'seller' && !sellerApproved && (
        <InlineError message="Marketplace item creation is locked until admin approves your seller onboarding. You can view your marketplace, but adding or changing products and services is disabled." />
      )}
      {buyerProcurementLocked && (
        <InlineError message="Buyer procurement is locked until admin approval. You can browse the marketplace and view seller/item details, but purchase and RFQ actions are disabled." />
      )}

      {/* KPI Cards Strip - Always Visible Immediately */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Items"
          value={filtered.length}
          subtext="Active listings in catalogue"
          icon={Boxes}
          tone="blue"
          active={kindFilter === 'all'}
          onClick={() => setKindFilter('all')}
          loading={isInitialLoading}
        />
        <KpiCard
          label="Products"
          value={products.length}
          subtext="Physical manufactured goods"
          icon={PackageSearch}
          tone="green"
          active={kindFilter === 'product'}
          onClick={() => setKindFilter('product')}
          loading={isInitialLoading}
        />
        <KpiCard
          label="Services"
          value={services.length}
          subtext="Commercial and technical services"
          icon={Wrench}
          tone="purple"
          active={kindFilter === 'service'}
          onClick={() => setKindFilter('service')}
          loading={isInitialLoading}
        />
        <KpiCard
          label="Avg. Value"
          value={formatCurrency(averageValue)}
          subtext="Mean listing unit price"
          icon={IndianRupee}
          tone="indigo"
          loading={isInitialLoading}
        />
      </div>

      {showForm && mode === 'seller' && (
        <CatalogueForm
          form={form}
          kind={formKind}
          saving={saving}
          isEdit={!!editingItem}
          categoryList={categoryList}
          uploadedImages={uploadedImages}
          uploadedDocuments={uploadedDocuments}
          uploading={uploading}
          onFileUpload={handleFileUpload}
          onRemoveFile={removeUploadedFile}
          onCancel={() => {
            uploadedImages.forEach(img => { if (img.localUrl) URL.revokeObjectURL(img.localUrl); });
            uploadedDocuments.forEach(doc => { if (doc.localUrl) URL.revokeObjectURL(doc.localUrl); });
            setUploadedImages([]);
            setUploadedDocuments([]);
            setShowForm(false);
            setEditingItem(null);
          }}
          onSubmit={submitForm}
          onChange={updateForm}
          onPreviewDocument={setPreviewDocument}
        />
      )}

      {error && <InlineError message={error} onRetry={loadCatalogue} />}

      {/* ── Search + Filter + View Toggle Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <ResponsiveFilterBar
          activeFilterCount={(searchTerm ? 1 : 0) + (kindFilter !== 'all' ? 1 : 0) + (categoryFilter ? 1 : 0) + (statusFilter ? 1 : 0) + (priceFilter ? 1 : 0) + (verificationFilter ? 1 : 0)}
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search name, seller, category..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
            </div>
          }
          filters={
            <>
              <div className="w-full sm:w-auto sm:min-w-[105px] sm:max-w-[125px]">
                <select
                  value={kindFilter}
                  onChange={event => setKindFilter(event.target.value as FilterKind)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                >
                  <option value="all">All types</option>
                  <option value="product">Products</option>
                  <option value="service">Services</option>
                </select>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[115px] sm:max-w-[140px]">
                <select
                  value={categoryFilter}
                  onChange={event => setCategoryFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                >
                  <option value="">All categories</option>
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[110px] sm:max-w-[130px]">
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                >
                  <option value="">All statuses</option>
                  {statuses.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[105px] sm:max-w-[125px]">
                <select
                  value={priceFilter}
                  onChange={event => setPriceFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                >
                  <option value="">All prices</option>
                  <option value="high">Above Rs. 10k</option>
                  <option value="mid">Rs. 1k to 10k</option>
                  <option value="low">Below Rs. 1k</option>
                </select>
              </div>

              {mode !== 'seller' && (
                <div className="w-full sm:w-auto sm:min-w-[110px] sm:max-w-[135px]">
                  <select
                    value={verificationFilter}
                    onChange={event => setVerificationFilter(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                  >
                    <option value="">All sellers</option>
                    <option value="verified">Verified sellers</option>
                    <option value="unverified">Pending sellers</option>
                  </select>
                </div>
              )}

              {(searchTerm || kindFilter !== 'all' || categoryFilter || statusFilter || priceFilter || verificationFilter) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setKindFilter('all');
                    setCategoryFilter('');
                    setStatusFilter('');
                    setPriceFilter('');
                    setVerificationFilter('');
                  }}
                  className="h-10 rounded-xl border-rose-200 bg-rose-50/60 text-xs font-extrabold text-rose-700 hover:bg-rose-100 min-w-[80px]"
                >
                  Reset
                </Button>
              )}
            </>
          }
          endContent={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
        />
      </div>

      {isInitialLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs animate-pulse p-4 space-y-4">
              <div className="w-full h-48 bg-slate-100 rounded-xl" />
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-slate-100" />
                <div className="h-5 w-3/4 rounded bg-slate-200" />
                <div className="h-3.5 w-full rounded bg-slate-100" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <div className="h-6 w-24 rounded bg-slate-200" />
                <div className="h-8 w-24 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? <EmptyState title="No marketplace items found matching filters" /> : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {pagedItems.map((item, index) => (
                <CatalogueCard
                  key={`${item.itemKind}-${item.id}`}
                  item={item}
                  mode={mode}
                  viewMode={viewMode}
                  onEdit={(item) => router.push(item.itemKind === 'product' ? `/seller/products/${item.id}/edit` : `/seller/services/${item.id}/edit`)}
                  onDelete={deleteItem}
                  onViewDetails={openViewDetails}
                  onPurchaseBid={openPurchaseBid}
                  onAddToCart={mode === 'buyer' ? handleAddToCart : undefined}
                  addingToCart={addingItemKey === `${item.itemKind}-${item.id}`}
                  canPurchase={buyerApproved}
                  onSellerClick={openSellerProfile}
                  actionState={buyerActions[`${item.itemKind}-${item.id}`]}
                  srNo={(page - 1) * pageSize + index + 1}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="relative overflow-x-auto">
                <table className={cn("w-full table-fixed text-left text-sm", mode === 'seller' ? "min-w-[1040px]" : "min-w-[900px]")}>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="px-3 py-3 w-14 text-center">
                        <CatalogueSortHead label="Sr. No" field="sr" sortKey={sortKey} sortDirection={sortDirection} onToggle={(k) => { setSortKey(k); setSortDirection(prev => sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }} />
                      </th>
                      <th className="px-2 py-3 w-16 text-center">Image</th>
                      <th className="px-3 py-3 w-[210px]">
                        <CatalogueSortHead label="Item" field="name" sortKey={sortKey} sortDirection={sortDirection} onToggle={(k) => { setSortKey(k); setSortDirection(prev => sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }} />
                      </th>
                      <th className="px-2 py-3 w-20 whitespace-nowrap">
                        <CatalogueSortHead label="Type" field="kind" sortKey={sortKey} sortDirection={sortDirection} onToggle={(k) => { setSortKey(k); setSortDirection(prev => sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }} />
                      </th>
                      <th className="px-2 py-3 w-28 whitespace-nowrap">
                        <CatalogueSortHead label="Category" field="category" sortKey={sortKey} sortDirection={sortDirection} onToggle={(k) => { setSortKey(k); setSortDirection(prev => sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }} />
                      </th>
                      <th className="px-2 py-3 w-24 whitespace-nowrap">
                        <CatalogueSortHead label="HSN" field="hsn" sortKey={sortKey} sortDirection={sortDirection} onToggle={(k) => { setSortKey(k); setSortDirection(prev => sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }} />
                      </th>
                      <th className="px-2 py-3 w-28 whitespace-nowrap">
                        <CatalogueSortHead label="Seller" field="seller" sortKey={sortKey} sortDirection={sortDirection} onToggle={(k) => { setSortKey(k); setSortDirection(prev => sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }} />
                      </th>
                      <th className="px-2 py-3 w-24 text-right whitespace-nowrap">
                        <CatalogueSortHead label="Price" field="price" sortKey={sortKey} sortDirection={sortDirection} onToggle={(k) => { setSortKey(k); setSortDirection(prev => sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }} align="right" />
                      </th>
                      <th className="px-2 py-3 w-24 whitespace-nowrap">
                        <CatalogueSortHead label="Status" field="status" sortKey={sortKey} sortDirection={sortDirection} onToggle={(k) => { setSortKey(k); setSortDirection(prev => sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }} />
                      </th>
                      {mode === 'seller' && (
                        <th className="px-2 py-3 w-36 whitespace-nowrap">
                          <CatalogueSortHead label="Date & Time" field="createdAt" sortKey={sortKey} sortDirection={sortDirection} onToggle={(k) => { setSortKey(k); setSortDirection(prev => sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }} />
                        </th>
                      )}
                      <th className="sticky right-0 z-10 bg-slate-50 px-3 py-3 w-[160px] min-w-[160px] text-right whitespace-nowrap border-l border-slate-200 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.05)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItems.map((item, index) => {
                      const value = cataloguePrice(item);
                      const status = item.status || 'DRAFT';
                      const imageSrc = getCatalogueImageSrc(item);
                      const actionState = buyerActions[`${item.itemKind}-${item.id}`];
                      const buyerStatusLabel = actionState?.purchase
                        ? `Purchase ${String(actionState.purchase.status || 'requested').replace(/_/g, ' ')}`
                        : actionState?.rfq
                          ? `RFQ ${String(actionState.rfq.status || 'sent').replace(/_/g, ' ')}`
                          : '';
                      return (
                        <tr key={`${item.itemKind}-${item.id}`} className="group border-b border-slate-100 bg-white transition hover:bg-slate-50/60 last:border-b-0">
                          <td className="px-3 py-3 text-center text-xs font-medium text-slate-500 align-middle">
                            {String((page - 1) * pageSize + index + 1).padStart(2, '0')}
                          </td>
                          <td className="px-2 py-3 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailsItem(item)}
                              className="inline-block h-8 w-8 rounded-md overflow-hidden border border-slate-200 bg-slate-50 hover:opacity-85 transition-opacity"
                              title="View details"
                            >
                              {imageSrc ? (
                                <img src={imageSrc} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                              ) : (
                                <div className={cn('flex h-full w-full items-center justify-center text-white', item.itemKind === 'product' ? 'bg-[#059669]' : 'bg-emerald-600')}>
                                  {item.itemKind === 'product' ? <PackageSearch className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                                </div>
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-3 align-top w-[210px]">
                            <div className="flex items-center gap-2 mb-0.5">
                              <EntityIdLink
                                label={`${item.itemKind === 'product' ? 'PRD' : 'SVC'}-${item.id}`}
                                id={item.id}
                                size="sm"
                                onClick={() => setSelectedDetailsItem(item)}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedDetailsItem(item)}
                              className="block text-left"
                            >
                              <p className="max-w-[190px] break-words text-sm font-black leading-snug text-neutral-900 hover:text-emerald-700 hover:underline line-clamp-2">
                                {item.name}
                              </p>
                            </button>
                            <p className="mt-0.5 max-w-[190px] break-words text-[11px] font-medium text-slate-500 line-clamp-2">{item.description || 'No description'}</p>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">
                              {item.itemKind}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top  ">
                            {item.category?.name ? (
                              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700 text-wrap-anywhere">
                                {item.category.name}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">NA</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {item.hsnCode ? (
                              <span className="font-mono text-[11px] font-bold text-slate-700 text-wrap-anywhere">{item.hsnCode}</span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">NA</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {item.seller?.name ? (
                              mode === 'seller' ? (
                                <span className="text-xs font-bold text-slate-700 text-wrap-anywhere">{item.seller.name}</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openSellerProfile(item.seller)}
                                  className="inline-flex items-start gap-1 text-xs font-bold text-slate-700 hover:text-[#059669] hover:underline text-wrap-anywhere text-left"
                                >
                                  <Store className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                                  <span className="text-wrap-anywhere">{item.seller.name}</span>
                                </button>
                              )
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap align-top">
                            <p className="text-sm font-black text-emerald-700">{formatCurrency(value)}</p>
                            {item.itemKind === 'product' && item.unitOfMeasure && (
                              <p className="text-[10px] font-bold text-slate-400">/{item.unitOfMeasure}</p>
                            )}
                            {item.itemKind === 'service' && item.pricingModel && (
                              <p className="text-[10px] font-bold text-slate-400">{item.pricingModel.replace(/_/g, ' ')}</p>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top whitespace-nowrap min-w-[112px]">
                            <Badge variant={status === 'ACTIVE' ? 'success' : status === 'ARCHIVED' || status === 'INACTIVE' ? 'warning' : 'default'}>
                              {status.replace(/_/g, ' ')}
                            </Badge>
                            {buyerStatusLabel && (
                              <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-emerald-700">{buyerStatusLabel}</p>
                            )}
                          </td>
                          {mode === 'seller' && (
                            <td className="px-3 py-3 align-top text-xs text-slate-500 font-semibold whitespace-nowrap tabular-nums">
                              {formatDateTime(item.createdAt)}
                            </td>
                          )}
                          <td className="sticky right-0 z-[5] w-[160px] min-w-[160px] bg-white px-3 py-3 text-right align-middle whitespace-nowrap border-l border-slate-100 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50/60">
                            <div className="inline-flex items-center justify-end gap-1">
                              {mode === 'seller' && (
                                <>
                                  <button type="button" onClick={() => openViewDetails(item)} title="View details" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0">
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={() => router.push(item.itemKind === 'product' ? `/seller/products/${item.id}/edit` : `/seller/services/${item.id}/edit`)} disabled={status === 'ARCHIVED'} title="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 shrink-0">
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={() => duplicateItem(item)} title="Duplicate" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0">
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => togglePublish(item)}
                                    title={status === 'ACTIVE' ? 'Deactivate' : 'Publish'}
                                    className={cn(
                                      "inline-flex h-8 w-8 items-center justify-center rounded-md border shrink-0 transition-colors",
                                      status === 'ACTIVE'
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                                    )}
                                  >
                                    {status === 'ACTIVE' ? (
                                      <ToggleRight className="h-3.5 w-3.5" />
                                    ) : (
                                      <ToggleLeft className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <button type="button" onClick={() => deleteItem(item)} title="Delete" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-red-600 hover:bg-red-50 shrink-0">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              {mode === 'admin' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDetailsItem(item)}
                                    title="View details"
                                    aria-label="Details"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  {item.seller && (
                                    <button
                                      type="button"
                                      onClick={() => openSellerProfile(item.seller)}
                                      title="View seller"
                                      aria-label="Seller"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors shrink-0"
                                    >
                                      <Store className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                              {mode === 'buyer' && (
                                <>
                                  <CompareToggleButton item={{ type: item.itemKind, id: item.id, categoryId: item.categoryId }} iconOnly />
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDetailsItem(item)}
                                    title="View details"
                                    aria-label="Details"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCart(item)}
                                    disabled={!buyerApproved || addingItemKey === `${item.itemKind}-${item.id}`}
                                    title={buyerApproved ? 'Add to cart' : 'Approval required'}
                                    aria-label="Add to cart"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#12335f] text-[#12335f] hover:bg-[#12335f]/5 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shrink-0"
                                  >
                                    {addingItemKey === `${item.itemKind}-${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openPurchaseBid(item)}
                                    disabled={!buyerApproved}
                                    title={buyerApproved ? 'Purchase or request bid' : 'Approval required'}
                                    aria-label="Purchase"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 transition-colors shrink-0"
                                  >
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="marketplace items" />
            </div>
          )}
          {viewMode === 'grid' && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="marketplace items" />
            </div>
          )}
        </>
      )}

      {/* Modals rendering */}
      {selectedDetailsItem && (
        <ItemDetailsModal
          item={selectedDetailsItem}
          mode={mode}
          actionState={buyerActions[`${selectedDetailsItem.itemKind}-${selectedDetailsItem.id}`]}
          onSellerClick={openSellerProfile}
          onPurchaseBid={openPurchaseBid}
          canPurchase={buyerApproved}
          onPreviewDocument={setPreviewDocument}
          onClose={() => setSelectedDetailsItem(null)}
        />
      )}

      {selectedPurchaseItem && (
        <PurchaseBidModal
          item={selectedPurchaseItem}
          actionState={buyerActions[`${selectedPurchaseItem.itemKind}-${selectedPurchaseItem.id}`]}
          onActionCreated={updateBuyerAction}
          onClose={() => setSelectedPurchaseItem(null)}
        />
      )}

      {selectedSeller && (
        <SellerProfileModal
          seller={selectedSeller}
          loading={sellerLoading}
          onClose={() => setSelectedSeller(null)}
        />
      )}
      <DocumentPreviewModal previewDocument={previewDocument} onClose={() => setPreviewDocument(null)} />
      {importKind && (
        <CatalogueImportModal
          kind={importKind}
          open={Boolean(importKind)}
          onClose={() => setImportKind(null)}
          onComplete={() => { void loadCatalogue(true); void loadImportHistory(true); }}
        />
      )}
      {mode === 'seller' && importHistory.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-sm font-black">Import History</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3">Batch</th><th className="pb-2 pr-3">Type</th><th className="pb-2 pr-3">File</th><th className="pb-2 pr-3">Rows</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Date</th><th className="pb-2">Report</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map(batch => (
                  <tr key={batch.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-mono">#{batch.id}</td>
                    <td className="py-2 pr-3">{batch.type}</td>
                    <td className="py-2 pr-3 max-w-[180px] truncate">{batch.fileName}</td>
                    <td className="py-2 pr-3">{batch.validRows}/{batch.totalRows} ok · {batch.invalidRows} fail</td>
                    <td className="py-2 pr-3"><Badge>{batch.status}</Badge></td>
                    <td className="py-2 pr-3">{formatDateTime(batch.createdAt)}</td>
                    <td className="py-2">
                      {batch.invalidRows > 0 ? (
                        <button type="button" className="text-[10px] font-black uppercase text-red-700 hover:underline" onClick={() => {
                          downloadCatalogueFile(`/api/catalogue/import/${batch.id}/errors/download`, `import_errors_${batch.id}.xlsx`)
                            .catch(() => toast.error('Download failed'));
                        }}>Errors</button>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">✔ Success</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {mode === 'buyer' && <CompareTray />}
    </div>
  );
}

function CatalogueForm({
  form,
  kind,
  saving,
  isEdit,
  categoryList,
  uploadedImages,
  uploadedDocuments,
  uploading,
  onFileUpload,
  onRemoveFile,
  onCancel,
  onSubmit,
  onChange,
  onPreviewDocument
}: {
  form: typeof blankForm;
  kind: ItemKind;
  saving: boolean;
  isEdit: boolean;
  categoryList: CategoryDto[];
  uploadedImages: any[];
  uploadedDocuments: any[];
  uploading: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => void;
  onRemoveFile: (id: number, type: 'image' | 'document') => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
  onChange: (field: keyof typeof blankForm, value: string) => void;
  onPreviewDocument: (preview: DocumentPreview) => void;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const rawPrice = kind === 'product' ? toNumber(form.price) : toNumber(form.basePrice);
  const discountPercent = toNumber(form.discount);

  const subtotal = rawPrice;
  const discountAmount = subtotal * (discountPercent / 100);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxBreakdown = calculateGstBreakdown(taxableAmount, form.splitTaxRate, form.igstTaxRate, form.otherTaxRate);
  const taxAmount = taxBreakdown.totalTaxAmount;
  const finalTotal = taxableAmount + taxAmount;

  const isProductValid = useMemo(() => {
    return (
      Boolean(form.name.trim()) &&
      Boolean(form.categoryId) &&
      Boolean(form.description.trim()) &&
      Boolean(form.unitOfMeasure.trim()) &&
      Boolean(form.itemCondition.trim()) &&
      Boolean(form.hsnCode.trim()) &&
      form.price !== '' &&
      toNumber(form.price) > 0 &&
      ((form.splitTaxRate !== '' && Number(form.splitTaxRate) >= 0) || (form.igstTaxRate !== '' && Number(form.igstTaxRate) >= 0)) &&
      uploadedImages.length >= 1
    );
  }, [form.name, form.categoryId, form.description, form.unitOfMeasure, form.itemCondition, form.hsnCode, form.price, form.splitTaxRate, form.igstTaxRate, uploadedImages.length]);

  const isServiceValid = useMemo(() => {
    return (
      Boolean(form.name.trim()) &&
      Boolean(form.categoryId) &&
      Boolean(form.description.trim()) &&
      Boolean(form.serviceArea.trim()) &&
      Boolean(form.pricingModel.trim()) &&
      form.basePrice !== '' &&
      toNumber(form.basePrice) > 0 &&
      ((form.splitTaxRate !== '' && Number(form.splitTaxRate) >= 0) || (form.igstTaxRate !== '' && Number(form.igstTaxRate) >= 0)) &&
      uploadedImages.length >= 1
    );
  }, [form.name, form.categoryId, form.description, form.serviceArea, form.pricingModel, form.basePrice, form.splitTaxRate, form.igstTaxRate, uploadedImages.length]);

  const isFormValid = kind === 'product' ? isProductValid : isServiceValid;

  const isFieldInvalid = (field: string) => {
    switch (field) {
      case 'name':
        return !form.name.trim();
      case 'categoryId':
        return !form.categoryId;
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
      case 'pricingModel':
        return 'Pricing model is required.';
      case 'price':
        return 'Price is required and must be greater than 0.';
      case 'basePrice':
        return 'Base price is required and must be greater than 0.';
      case 'taxRate':
        return 'GST / Tax rate is required.';
      case 'images':
        return `At least 1 ${kind} image is required.`;
      default:
        return undefined;
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    setAttemptedSubmit(true);
    if (!isFormValid) {
      e.preventDefault();
      toast.error(`Please complete all required fields and upload at least 1 image.`);
      return;
    }
    onSubmit(e);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in duration-200">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm', kind === 'product' ? 'bg-[#059669]' : 'bg-emerald-600')}>
              {kind === 'product' ? <PackageSearch className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#059669]">
                {isEdit ? 'Edit Item' : 'New Listing'}
              </p>
              <h2 className="truncate text-base font-black leading-tight text-neutral-950 sm:text-lg">
                {isEdit ? `Modify ${kind === 'product' ? 'Product' : 'Service'}` : `Add New ${kind === 'product' ? 'Product' : 'Service'}`}
              </h2>
            </div>
          </div>
          <button onClick={onCancel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <form onSubmit={handleFormSubmit} className="grid gap-3 lg:grid-cols-2">
            <Input
              label={`${kind === 'product' ? 'Product' : 'Service'} Name`}
              value={form.name}
              onChange={event => { onChange('name', event.target.value); markTouched('name'); }}
              onBlur={() => markTouched('name')}
              error={getFieldError('name')}
              required
              placeholder="e.g. Structural Steel Beams, IT Advisory Services"
              className="bg-white"
            />
            <Select label="Visibility Status" value={form.status} onChange={event => onChange('status', event.target.value)} className="bg-white">
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
            <Select
              label="Category"
              value={form.categoryId}
              onChange={event => { onChange('categoryId', event.target.value); markTouched('categoryId'); }}
              onBlur={() => markTouched('categoryId')}
              error={getFieldError('categoryId')}
              required
              className="bg-white"
            >
              <option value="">Select Category</option>
              {categoryList.map(cat => <option key={cat.id} value={String(cat.id)}>{cat.name}</option>)}
            </Select>
            {kind === 'product' ? (
              <>
                <Input
                  label="Price (INR)"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={event => { onChange('price', event.target.value); markTouched('price'); }}
                  onBlur={() => markTouched('price')}
                  error={getFieldError('price')}
                  required
                  placeholder="0.00"
                  className="bg-white"
                />
                <Input label="Discount (%)" type="number" min="0" max="100" step="0.01" value={form.discount} onChange={event => onChange('discount', event.target.value)} placeholder="0.00 (Optional)" className="bg-white" />
                <Select
                  label="Unit Of Measure"
                  value={form.unitOfMeasure}
                  onChange={event => { onChange('unitOfMeasure', event.target.value); markTouched('unitOfMeasure'); }}
                  onBlur={() => markTouched('unitOfMeasure')}
                  error={getFieldError('unitOfMeasure')}
                  required
                  className="bg-white"
                >
                  <option value="">Select Unit</option>
                  {QUANTITY_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </Select>
                <Select
                  label="Item Condition"
                  value={form.itemCondition}
                  onChange={event => { onChange('itemCondition', event.target.value); markTouched('itemCondition'); }}
                  onBlur={() => markTouched('itemCondition')}
                  error={getFieldError('itemCondition')}
                  required
                  className="bg-white"
                >
                  <option value="">Select Condition</option>
                  {ITEM_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
                <Input
                  label="HSN Code"
                  value={form.hsnCode}
                  onChange={event => { onChange('hsnCode', event.target.value); markTouched('hsnCode'); }}
                  onBlur={() => markTouched('hsnCode')}
                  error={getFieldError('hsnCode')}
                  required
                  placeholder="8-digit HSN code"
                  className="bg-white"
                />
              </>
            ) : (
              <>
                <Input
                  label="Base Price (INR)"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.basePrice}
                  onChange={event => { onChange('basePrice', event.target.value); markTouched('basePrice'); }}
                  onBlur={() => markTouched('basePrice')}
                  error={getFieldError('basePrice')}
                  required
                  placeholder="0.00"
                  className="bg-white"
                />
                <Input label="Discount (%)" type="number" min="0" max="100" step="0.01" value={form.discount} onChange={event => onChange('discount', event.target.value)} placeholder="0.00 (Optional)" className="bg-white" />
                <Select
                  label="Pricing Model"
                  value={form.pricingModel}
                  onChange={event => { onChange('pricingModel', event.target.value); markTouched('pricingModel'); }}
                  onBlur={() => markTouched('pricingModel')}
                  error={getFieldError('pricingModel')}
                  required
                  className="bg-white"
                >
                  <option value="FIXED">Fixed</option>
                  <option value="HOURLY">Hourly</option>
                  <option value="DAILY">Daily</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="PER_PROJECT">Per Project</option>
                  <option value="CUSTOM">Custom</option>
                </Select>
                <Input
                  label="Service Area"
                  value={form.serviceArea}
                  onChange={event => { onChange('serviceArea', event.target.value); markTouched('serviceArea'); }}
                  onBlur={() => markTouched('serviceArea')}
                  error={getFieldError('serviceArea')}
                  required
                  placeholder="e.g. Delhi NCR, Pan-India"
                  className="bg-white"
                />
              </>
            )}
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                GST & Taxation <span className="text-red-500 ml-0.5 font-bold">*</span>
              </label>
              <GstTaxPicker
                splitRate={form.splitTaxRate}
                igstRate={form.igstTaxRate}
                additionalRate={form.otherTaxRate}
                taxableAmount={taxableAmount}
                onChange={next => {
                  onChange('splitTaxRate', next.splitRate);
                  onChange('igstTaxRate', next.igstRate);
                  onChange('otherTaxRate', next.additionalRate);
                  markTouched('taxRate');
                }}
              />
              {getFieldError('taxRate') && (
                <p className="mt-1 text-[10px] sm:text-xs text-red-500 font-semibold">{getFieldError('taxRate')}</p>
              )}
            </div>
            <div className="lg:col-span-2 space-y-1">
              <label className="block text-[10px] font-bold sm:font-extrabold uppercase tracking-wide sm:tracking-widest text-slate-500 sm:text-[11px]">
                Description <span className="text-red-500 ml-1 font-bold">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={event => { onChange('description', event.target.value); markTouched('description'); }}
                onBlur={() => markTouched('description')}
                rows={3}
                placeholder="Provide descriptive details, technical specifications, and delivery terms..."
                className={cn(
                  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20",
                  getFieldError('description') && "border-red-500 focus:ring-red-500/20 bg-red-50/30"
                )}
              />
              {getFieldError('description') && (
                <p className="text-[10px] sm:text-xs text-red-500">{getFieldError('description')}</p>
              )}
            </div>

            {/* Real-time Quotation Total Preview */}
            <div className="lg:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/10 p-4 font-sans">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Quotation Total Summary
              </h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subtotal</p>
                  <p className="text-sm font-black text-slate-900">{formatCurrency(subtotal)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Discount ({discountPercent}%)</p>
                  <p className="text-sm font-black text-red-650">-{formatCurrency(discountAmount)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Taxable Amt</p>
                  <p className="text-sm font-black text-slate-900">{formatCurrency(taxableAmount)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tax ({taxBreakdown.label})</p>
                  <p className="text-sm font-black text-slate-950">+{formatCurrency(taxAmount)}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-800">Final Total</p>
                  <p className="text-[10px] font-semibold text-slate-500">Estimated cost inclusive of tax & discount</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-700">{formatCurrency(finalTotal)}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2 border-t border-slate-250/80 pt-3">
              {/* Image upload section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {kind === 'product' ? 'Product Images' : 'Service Images'} <span className="text-red-500 ml-1 font-bold">*</span>
                </label>

                {uploadedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {uploadedImages.map(img => (
                      <div key={img.id} className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 group bg-slate-50">
                        <img src={img.localUrl || getCatalogueImageUrl(img.id)} alt={img.originalName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                onPreviewDocument(await getFileAssetPreview({
                                  id: img.id,
                                  fileId: img.id,
                                  url: img.localUrl || getCatalogueImageUrl(img.id),
                                  originalName: img.originalName,
                                  mimeType: img.mimeType || 'image/png'
                                }, img.originalName));
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Unable to view image');
                              }
                            }}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                            title="View image"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFile(img.id, 'image')}
                            className="p-1.5 rounded bg-red-955 hover:bg-red-900 transition-colors cursor-pointer"
                            title="Delete image"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <label className={cn(
                  "flex flex-col items-center justify-center border border-dashed rounded-lg p-4 bg-white cursor-pointer transition-colors",
                  getFieldError('images') ? "border-red-400 bg-red-50/20" : "border-slate-300 hover:bg-slate-50"
                )}>
                  <Upload className={cn("h-5 w-5 mb-1", getFieldError('images') ? "text-red-400" : "text-slate-400")} />
                  <span className="text-[10px] font-bold text-slate-500">Click to Upload Image (Required)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading}
                    onChange={(e) => onFileUpload(e, 'image')}
                    className="hidden"
                  />
                </label>
                {getFieldError('images') && (
                  <p className="text-[10px] sm:text-xs text-red-500 font-semibold">{getFieldError('images')}</p>
                )}
              </div>

              {/* Document upload section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Specification Documents (Optional)
                </label>

                {uploadedDocuments.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {uploadedDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText className="h-3.5 w-3.5 text-[#059669] shrink-0" />
                          <span className="text-[10px] font-bold text-slate-700 truncate">{doc.originalName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                onPreviewDocument(await getFileAssetPreview({
                                  id: doc.id,
                                  fileId: doc.id,
                                  url: doc.localUrl || getCatalogueImageUrl(doc.id),
                                  originalName: doc.originalName,
                                  mimeType: doc.mimeType
                                }, doc.originalName));
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Unable to view document');
                              }
                            }}
                            className="text-[#059669] hover:text-emerald-800 p-0.5 cursor-pointer"
                            title="View document"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFile(doc.id, 'document')}
                            className="text-red-500 hover:text-red-750 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-lg p-4 bg-white cursor-pointer hover:bg-slate-55 transition-colors">
                  <FileUp className="h-5 w-5 text-slate-400 mb-1" />
                  <span className="text-[10px] font-bold text-slate-500">Click to Upload Document</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                    multiple
                    disabled={uploading}
                    onChange={(e) => onFileUpload(e, 'document')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {uploading && (
              <div className="lg:col-span-2 flex items-center justify-center gap-2 py-2 text-xs text-[#059669] font-bold bg-emerald-50 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading catalogue assets...</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-200/80 pt-3 lg:col-span-2">
              <Button type="button" variant="outline" onClick={onCancel} className="h-9 rounded-lg text-xs font-black uppercase tracking-wider border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</Button>
              <Button
                type="submit"
                disabled={!isFormValid || saving || uploading}
                className={cn("h-9 rounded-lg text-xs font-black uppercase tracking-wider text-white", !isFormValid && "opacity-50 cursor-not-allowed", kind === 'product' ? 'bg-[#059669] hover:bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-700')}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />{saving ? 'Saving...' : isEdit ? `Save Changes` : `Create ${kind}`}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CatalogueCard({ item, mode, viewMode = 'grid', actionState, canPurchase = true, onEdit, onDelete, onViewDetails, onPurchaseBid, onAddToCart, addingToCart, onSellerClick, srNo }: {
  item: CatalogueRecord;
  mode: CatalogueMode;
  viewMode?: 'grid' | 'list';
  actionState?: BuyerActionState;
  canPurchase?: boolean;
  onEdit?: (item: CatalogueRecord) => void;
  onDelete?: (item: CatalogueRecord) => void;
  onViewDetails?: (item: CatalogueRecord) => void;
  onPurchaseBid?: (item: CatalogueRecord) => void;
  onAddToCart?: (item: CatalogueRecord) => void;
  addingToCart?: boolean;
  onSellerClick?: (seller: CatalogueRecord['seller']) => void;
  srNo?: number;
}) {
  const value = cataloguePrice(item);
  const status = item.status || 'DRAFT';
  const statusVariant = status === 'ACTIVE' ? 'success' : status === 'ARCHIVED' || status === 'INACTIVE' ? 'warning' : 'default';
  const buyerStatusLabel = actionState?.purchase
    ? `Purchase ${String(actionState.purchase.status || 'requested').replace(/_/g, ' ')}`
    : actionState?.rfq
      ? `RFQ ${String(actionState.rfq.status || 'sent').replace(/_/g, ' ')}`
      : '';
  const previouslyUsedLabel = actionState?.purchase
    ? 'Already purchased/requested'
    : actionState?.rfq
      ? 'Already bid/RFQ sent'
      : '';
  const imageSrc = getCatalogueImageSrc(item);

  if (viewMode === 'list') {
    return (
      <Card className="w-full rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/30 overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              {srNo !== undefined && (
                <div className="hidden sm:flex h-16 w-14 shrink-0 select-none flex-col items-center justify-center rounded-xl bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border border-slate-200/70">
                  <span className="text-[8px] font-bold text-slate-400">SR.</span>
                  <span className="text-base font-black text-slate-800 leading-none mt-0.5">#{srNo}</span>
                </div>
              )}
              {/* Product Image 2X size */}
              <div
                onClick={() => onViewDetails?.(item)}
                className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-50/80 p-1.5 cursor-pointer hover:opacity-90 transition-all flex items-center justify-center shadow-xs"
                title="Click to view details"
              >
                {imageSrc ? (
                  <img src={imageSrc} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-contain" />
                ) : (
                  <div className={cn('flex h-full w-full items-center justify-center rounded-xl text-white shadow-sm', item.itemKind === 'product' ? 'bg-[#059669]' : 'bg-emerald-600')}>
                    {item.itemKind === 'product' ? <PackageSearch className="h-8 w-8" /> : <Wrench className="h-8 w-8" />}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-900 text-white px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider">
                    {item.itemKind === 'product' ? 'PRD' : 'SVC'}-{item.id}
                  </span>
                  <Badge variant={statusVariant} className="text-[9px] uppercase font-black px-2 py-0.5">{status.replace(/_/g, ' ')}</Badge>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600">{item.itemKind}</span>
                  {item.category?.name && (
                    <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 text-[9px] font-bold uppercase truncate max-w-[200px]">
                      {item.category.name}
                    </span>
                  )}
                  {mode === 'buyer' && previouslyUsedLabel && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                      {previouslyUsedLabel}
                    </span>
                  )}
                </div>

                <h3
                  onClick={() => onViewDetails?.(item)}
                  className="text-base font-extrabold text-slate-900 leading-snug cursor-pointer hover:text-emerald-700 hover:underline line-clamp-1"
                  title="Click to view details"
                >
                  {item.name}
                </h3>

                <p className="line-clamp-2 text-xs font-medium text-slate-500 leading-relaxed">{item.description || 'No description provided'}</p>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-400 pt-0.5">
                  {mode === 'seller' ? (
                    <span>Created: {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                  ) : item.seller?.name ? (
                    <button type="button" onClick={() => onSellerClick?.(item.seller)} className="flex items-center gap-1 text-slate-600 font-semibold hover:text-[#059669]">
                      <Store className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {item.seller.name}
                    </button>
                  ) : null}
                  {item.itemKind === 'product' && item.unitOfMeasure && (
                    <span>Unit: {item.unitOfMeasure}</span>
                  )}
                  {item.itemKind === 'product' && item.itemCondition && (
                    <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-black">
                      {ITEM_CONDITIONS.find(c => c.value === item.itemCondition)?.label || item.itemCondition.replace(/_/g, ' ')}
                    </span>
                  )}
                  {item.itemKind === 'service' && item.pricingModel && (
                    <span>Pricing: {item.pricingModel.replace(/_/g, ' ')}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Price</span>
                <span className="text-base sm:text-lg font-black text-emerald-700">{formatCurrency(value)}</span>
                {buyerStatusLabel && <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">{buyerStatusLabel}</p>}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                {mode === 'seller' && onEdit && onDelete && (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={() => onViewDetails?.(item)} className="h-8 text-xs font-bold uppercase rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50">
                      <Eye className="h-3.5 w-3.5 mr-1 text-slate-400" /> View
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item)} disabled={status === 'ARCHIVED'} className="h-8 text-xs font-bold uppercase rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <Settings2 className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Edit
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onDelete(item)} className="h-8 px-2.5 text-xs font-bold uppercase rounded-lg border-red-200 text-red-600 hover:bg-red-50" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {mode === 'admin' && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetails?.(item)}
                      className="h-8 px-3 rounded-lg text-xs font-bold uppercase border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="mr-1 h-3.5 w-3.5 text-slate-400" />
                      View Details
                    </Button>
                    {item.seller && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSellerClick?.(item.seller)}
                        className="h-8 px-3 rounded-lg text-xs font-bold uppercase border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        <Store className="mr-1 h-3.5 w-3.5" />
                        Seller
                      </Button>
                    )}
                  </>
                )}
                {mode === 'buyer' && (
                  <>
                    <CompareToggleButton item={{ type: item.itemKind, id: item.id, categoryId: item.categoryId }} iconOnly />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetails?.(item)}
                      className="h-8 px-3 rounded-lg text-xs font-bold uppercase border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="mr-1 h-3.5 w-3.5 text-slate-400" />
                      Details
                    </Button>
                    {onAddToCart && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAddToCart(item)}
                        disabled={!canPurchase || !!addingToCart}
                        className="h-8 px-3 rounded-lg text-xs font-bold uppercase border-[#12335f] text-[#12335f] hover:bg-[#12335f]/5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                        {addingToCart ? 'Adding...' : 'Add to Cart'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onPurchaseBid?.(item)}
                      disabled={!canPurchase}
                      className="h-8 px-3 rounded-lg text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                      {canPurchase ? 'Buy / Bid' : 'Locked'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid Layout - Spacious, prominent product images, clean hierarchy
  return (
    <Card className="group relative flex flex-col h-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md hover:border-emerald-500/40 transition-all duration-300">
      
      {/* Top Product Image Showcase Container (Compact, Prominent) */}
      <div className="relative w-full h-40 sm:h-48 bg-slate-50 overflow-hidden flex items-center justify-center p-4 border-b border-slate-100">
        
        {/* Badges on top-left of image */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 flex-wrap">
          {srNo !== undefined && (
            <span className="rounded-md bg-slate-900/80 backdrop-blur-md px-2 py-0.5 text-[9px] font-mono font-black text-white tracking-wider shadow-xs">
              #{srNo}
            </span>
          )}
          <span className="rounded-md bg-white/95 backdrop-blur-md px-2 py-0.5 text-[9px] font-mono font-bold text-slate-700 border border-slate-200 shadow-xs">
            {item.itemKind === 'product' ? 'PRD' : 'SVC'}-{item.id}
          </span>
        </div>

        {/* Status Badge on top-right of image */}
        <div className="absolute top-3 right-3 z-10">
          <Badge variant={statusVariant} className="shadow-xs backdrop-blur-md text-[9px] font-black uppercase px-2 py-0.5">
            {status.replace(/_/g, ' ')}
          </Badge>
        </div>

        {/* Large Prominent Product Image */}
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105 cursor-pointer"
            onClick={() => onViewDetails?.(item)}
          />
        ) : (
          <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-sm', item.itemKind === 'product' ? 'bg-[#059669]' : 'bg-emerald-600')}>
            {item.itemKind === 'product' ? <PackageSearch className="h-8 w-8" /> : <Wrench className="h-8 w-8" />}
          </div>
        )}
      </div>

      {/* Card Content Body */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-2">
          
          {/* Category & Item Type Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
              {item.itemKind}
            </span>
            {item.category?.name && (
              <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 text-[9px] font-bold uppercase truncate max-w-[130px]">
                {item.category.name}
              </span>
            )}
            {mode === 'buyer' && previouslyUsedLabel && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                {previouslyUsedLabel}
              </span>
            )}
          </div>

          {/* Item Title */}
          <h3
            onClick={() => onViewDetails?.(item)}
            className="text-sm sm:text-base font-extrabold text-slate-900 line-clamp-2 leading-snug cursor-pointer hover:text-emerald-700 transition-colors"
            title={item.name}
          >
            {item.name}
          </h3>

          {/* Item Description */}
          <p className="text-xs font-medium text-slate-500 line-clamp-2 leading-relaxed">
            {item.description || 'No description provided'}
          </p>
        </div>

        {/* Pricing & Footer Actions */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unit Price</span>
              <span className="text-base sm:text-lg font-black text-emerald-700">
                {formatCurrency(value)}
                {item.itemKind === 'product' && item.unitOfMeasure ? (
                  <span className="text-xs font-semibold text-slate-400 ml-1">/{item.unitOfMeasure}</span>
                ) : null}
              </span>
            </div>
            {mode === 'seller' ? (
              <span className="text-[10px] font-medium text-slate-400">
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
              </span>
            ) : item.seller?.name ? (
              <button
                type="button"
                onClick={() => onSellerClick?.(item.seller)}
                className="text-[11px] font-bold text-slate-600 hover:text-emerald-700 truncate max-w-[120px] flex items-center gap-1"
                title={item.seller.name}
              >
                <Store className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="truncate">{item.seller.name}</span>
              </button>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {mode === 'seller' && onEdit && onDelete && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails?.(item)}
                  className="flex-1 h-8 text-[11px] font-bold uppercase rounded-lg text-slate-700 hover:bg-slate-50 border-slate-200"
                >
                  <Eye className="h-3 w-3 mr-1 text-slate-400" />
                  View
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(item)}
                  className="flex-1 h-8 text-[11px] font-bold uppercase rounded-lg text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                >
                  <Settings2 className="h-3 w-3 mr-1 text-emerald-500" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(item)}
                  className="h-8 w-8 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 shrink-0 rounded-lg"
                  title="Delete item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}

            {mode === 'admin' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails?.(item)}
                  className="flex-1 h-8 rounded-lg text-xs font-bold uppercase border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="mr-1 h-3.5 w-3.5 text-slate-400" />
                  Details
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!item.seller}
                  onClick={() => item.seller && onSellerClick?.(item.seller)}
                  className="flex-1 h-8 rounded-lg text-xs font-bold uppercase border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Store className="mr-1 h-3.5 w-3.5" />
                  Seller
                </Button>
              </>
            )}

            {mode === 'buyer' && (
              <>
                <CompareToggleButton item={{ type: item.itemKind, id: item.id, categoryId: item.categoryId }} iconOnly />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails?.(item)}
                  className="flex-1 h-8 rounded-lg text-xs font-bold uppercase border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="mr-1 h-3.5 w-3.5 text-slate-400" />
                  Details
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onPurchaseBid?.(item)}
                  disabled={!canPurchase}
                  className="flex-1 h-8 rounded-lg text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                  {canPurchase ? 'Buy / Bid' : 'Locked'}
                </Button>
              </>
            )}
          </div>

        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card className="group relative overflow-hidden rounded-[22px] border-0 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-500/20">
      <div className="absolute right-0 top-0 h-16 w-16 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all duration-300" />
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-1.5 text-xl font-extrabold text-slate-900 font-mono tracking-tight">{value}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 shadow-sm ring-1 ring-slate-100 transition-all duration-300 group-hover:scale-105 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:ring-emerald-100">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Sort header used in the marketplace table view. Toggles between ascending,
 * descending, and unsorted states for the column it represents.
 */
function CatalogueSortHead({
  label,
  field,
  sortKey,
  sortDirection,
  onToggle,
  align = 'left'
}: {
  label: string;
  field: 'sr' | 'name' | 'kind' | 'category' | 'seller' | 'price' | 'status' | 'hsn' | 'createdAt';
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  onToggle: (field: any) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const active = sortKey === field;
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest hover:text-emerald-700 transition-colors',
        active ? 'text-[#12335f]' : 'text-slate-500',
        align === 'right' && 'justify-end w-full',
        align === 'center' && 'justify-center w-full'
      )}
    >
      {label}
      {active ? (
        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function ItemDetailsModal({ item, mode, actionState, canPurchase = true, onSellerClick, onPurchaseBid, onPreviewDocument, onClose }: {
  item: CatalogueRecord;
  mode: CatalogueMode;
  actionState?: BuyerActionState;
  canPurchase?: boolean;
  onSellerClick: (seller: CatalogueRecord['seller']) => void;
  onPurchaseBid: (item: CatalogueRecord) => void;
  onPreviewDocument: (preview: DocumentPreview) => void;
  onClose: () => void;
}) {
  const value = cataloguePrice(item);
  const media = catalogueMedia(item);
  const photos = media.filter(file => file.kind === 'image');
  const documents = media.filter(file => file.kind === 'document');
  const firstPhotoId = photos[0]?.fileId || getItemImageId(item);
  const [activePhotoId, setActivePhotoId] = useState<number | null>(firstPhotoId || null);
  const buyerStatusLabel = actionState?.purchase
    ? `Direct purchase ${String(actionState.purchase.status || 'requested').replace(/_/g, ' ')}`
    : actionState?.rfq
      ? `RFQ ${String(actionState.rfq.status || 'sent').replace(/_/g, ' ')}`
      : '';
  const handleOpenDocument = async (document: { fileId?: number; label: string; originalName?: string; mimeType?: string }) => {
    try {
      onPreviewDocument(await getFileAssetPreview({
        fileId: document.fileId,
        originalName: document.originalName || document.label,
        mimeType: document.mimeType
      }, document.label));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open document');
    }
  };

  const activePhoto = photos.find(photo => photo.fileId === activePhotoId) || photos[0];
  const hasPrice = value > 0;
  const metaTiles = item.itemKind === 'product'
    ? [
      { label: 'Price', value: hasPrice ? formatCurrency(value) : 'Price on request', tone: 'value' },
      { label: 'Unit of Measure', value: item.unitOfMeasure || 'Not specified' },
      { label: 'HSN Code', value: item.hsnCode || 'Not specified' },
      { label: 'Condition', value: item.itemCondition ? (ITEM_CONDITIONS.find(c => c.value === item.itemCondition)?.label || item.itemCondition.replace(/_/g, ' ')) : 'Not specified' }
    ]
    : [
      { label: 'Base Price', value: hasPrice ? formatCurrency(value) : 'Price on request', tone: 'value' },
      { label: 'Pricing Model', value: item.pricingModel ? item.pricingModel.replace(/_/g, ' ') : 'Not specified' },
      { label: 'Service Area', value: item.serviceArea || 'Not specified' },
      { label: 'Category', value: item.category?.name || 'Not specified' }
    ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm', item.itemKind === 'product' ? 'bg-[#059669]' : 'bg-emerald-600')}>
              {item.itemKind === 'product' ? <PackageSearch className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#059669]">{item.itemKind} Details</p>
              <h2 className="truncate text-base font-black leading-tight text-neutral-950 sm:text-lg">{item.name}</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="border-b border-slate-200 bg-slate-50 p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  disabled={!activePhoto?.fileId}
                  onClick={async () => {
                    if (!activePhoto?.fileId) return;
                    try {
                      onPreviewDocument(await getFileAssetPreview({
                        id: activePhoto.fileId,
                        fileId: activePhoto.fileId,
                        url: getCatalogueImageUrl(activePhoto.fileId),
                        originalName: activePhoto.originalName || activePhoto.label || item.name,
                        mimeType: activePhoto.mimeType || 'image/png'
                      }, activePhoto.label || item.name));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Unable to view image');
                    }
                  }}
                  className="flex aspect-[4/3] w-full items-center justify-center bg-slate-100 text-slate-400 sm:aspect-[16/10] lg:aspect-[4/3]"
                  title={activePhoto?.fileId ? 'View uploaded image' : undefined}
                >
                  {activePhoto?.fileId ? (
                    <img src={getCatalogueImageUrl(activePhoto.fileId)} alt={activePhoto.label || item.name} loading="lazy" decoding="async" className="h-full w-full object-contain" />
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-xs font-bold text-slate-500">
                      <ImageIcon className="h-8 w-8" />
                      No product image uploaded
                    </span>
                  )}
                </button>
              </div>

              {photos.length > 0 && (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Photos</h4>
                    <span className="text-[10px] font-bold text-slate-500">{photos.length} uploaded</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-5">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.fileId || index}
                        type="button"
                        onClick={() => setActivePhotoId(photo.fileId || null)}
                        className={cn(
                          'relative aspect-square overflow-hidden rounded-xl border bg-white transition-all',
                          activePhotoId === photo.fileId ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-200'
                        )}
                        title={photo.label}
                      >
                        {photo.fileId ? (
                          <img src={getCatalogueImageUrl(photo.fileId)} alt={photo.label} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-slate-400">
                            <ImageIcon className="h-4 w-4" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              <div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="success">{item.status || 'ACTIVE'}</Badge>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600">{item.itemKind}</span>
                  {item.category?.name && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">{item.category.name}</span>}
                  {buyerStatusLabel && <span className="rounded bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">{buyerStatusLabel}</span>}
                </div>
                <h3 className="mt-3 break-words text-xl font-black leading-tight text-neutral-950 sm:text-2xl">{item.name}</h3>
              </div>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</h4>
                <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-600 whitespace-pre-wrap">
                  {item.description || 'No description provided.'}
                </p>
              </section>

              {/* Pricing & Taxation Breakdown */}
              {(() => {
                const taxPercent = toNumber(item.taxRate || 0);
                const discountPercent = toNumber(item.discount || 0);
                const subtotal = value;
                const discountAmount = subtotal * (discountPercent / 100);
                const taxableAmount = Math.max(0, subtotal - discountAmount);
                const taxAmount = taxableAmount * (taxPercent / 100);
                const finalTotal = taxableAmount + taxAmount;

                return (
                  <section className="rounded-xl border border-emerald-100 bg-emerald-50/10 p-4 font-sans">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-3 flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      Pricing & Quotation Breakdown
                    </h4>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Base Price</p>
                        <p className="text-sm font-black text-slate-900">{hasPrice ? formatCurrency(subtotal) : 'Price on Request'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-550">Discount ({discountPercent}%)</p>
                        <p className="text-sm font-black text-red-650">-{formatCurrency(discountAmount)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Taxable Amt</p>
                        <p className="text-sm font-black text-slate-900">{formatCurrency(taxableAmount)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">GST ({taxPercent}% total)</p>
                        <p className="text-sm font-black text-slate-950">+{formatCurrency(taxAmount)}</p>
                        {taxPercent > 0 && (
                          <p className="text-[9px] font-bold text-slate-500">IGST {taxPercent}% or CGST+SGST {taxPercent / 2}% + {taxPercent / 2}%</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-800">Final Total</p>
                        <p className="text-[9px] font-semibold text-slate-500">Estimated cost inclusive of tax & discount</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-700">{hasPrice ? formatCurrency(finalTotal) : 'Price on Request'}</p>
                      </div>
                    </div>
                  </section>
                );
              })()}

              <section className="grid grid-cols-2 gap-2">
                {metaTiles.map(tile => (
                  <div key={tile.label} className="min-h-[72px] rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{tile.label}</p>
                    <p className={cn('mt-1 break-words text-sm font-black text-slate-800', tile.tone === 'value' && 'text-base text-emerald-800')}>
                      {tile.value}
                    </p>
                  </div>
                ))}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documents</h4>
                  <span className="text-[10px] font-bold text-slate-500">{documents.length} files</span>
                </div>
                {documents.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {documents.map(document => (
                      <div key={document.fileId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#059669]">
                            <FileText className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-neutral-900">{document.label}</p>
                            <p className="truncate text-[10px] font-semibold text-slate-500">{document.mimeType || 'Uploaded file'}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(document)}
                          className="flex h-8 shrink-0 items-center rounded-lg border border-emerald-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-[#059669] hover:bg-emerald-50"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
                    No documents uploaded for this {item.itemKind}.
                  </p>
                )}
              </section>

              {item.seller && (
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seller Information</h4>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[#059669]">
                      <Store className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSellerClick?.(item.seller)}
                        className="block truncate text-left text-sm font-black text-[#059669] transition-colors hover:text-neutral-900 hover:underline"
                        title="Click to view seller profile"
                      >
                        {item.seller.name || 'Seller'}
                      </button>
                      <p className="truncate text-xs font-semibold text-slate-500">{item.seller.email || 'Email not available'}</p>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {item.seller && mode !== 'buyer' && (
              <Button variant="outline" onClick={() => onSellerClick?.(item.seller)} className="h-10 rounded-xl border-emerald-200 text-xs font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-50">
                <Store className="mr-2 h-4 w-4" />
                Open Seller Profile
              </Button>
            )}
            {mode === 'buyer' && (
              <Button
                onClick={() => onPurchaseBid(item)}
                disabled={!canPurchase}
                title={canPurchase ? 'Purchase or request bid' : 'Admin approval required before procurement actions'}
                className="h-10 rounded-xl bg-emerald-600 px-5 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {canPurchase ? (buyerStatusLabel ? 'Create Another Request' : 'Purchase / Bid') : 'Approval Required'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseBidModal({ item, actionState, onActionCreated, onClose }: {
  item: CatalogueRecord;
  actionState?: BuyerActionState;
  onActionCreated: (item: CatalogueRecord, action: BuyerActionState) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'purchase' | 'bid'>('purchase');
  const [quantity, setQuantity] = useState<number>(1);
  const [subject, setSubject] = useState<string>(`RFQ for ${item.name}`);
  const [message, setMessage] = useState<string>(
    `Dear ${item.seller?.name || 'Seller'},\n\nWe are highly interested in your ${item.itemKind} "${item.name}".\n\nPlease provide your best custom quote, delivery timeline, and warranty terms for this item.\n\nThanks,\nBuyer Team`
  );
  const [docUrl, setDocUrl] = useState<string>('');
  const [estimatedValue, setEstimatedValue] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const handleUploadQuoteDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDoc(true);
    try {
      const optimizedFile = await compressImage(file);
      const formData = new FormData();
      formData.append('file', optimizedFile);
      const res = await api.fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setDocUrl(data?.data?.url || data?.url || '');
        toast.success('Document attached successfully');
      } else {
        toast.error('Upload failed. Please try again.');
      }
    } catch {
      toast.error('Upload error. Please try again.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const price = cataloguePrice(item);
  const totalAmount = price * quantity;

  const handleDirectPurchase = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // First create a requirement for the direct purchase to uniquely link to this product/service
      const requirement = await postApi('/api/buyer/requirements', {
        title: `Direct Purchase: ${item.name}`,
        description: item.description || `Direct purchase request for ${item.name}`,
        estimatedValue: totalAmount,
        procurementMethod: 'DIRECT_PURCHASE',
        items: [{
          productId: item.itemKind === 'product' ? item.id : undefined,
          itemName: item.name,
          description: item.description || '',
          quantity: quantity,
          unitOfMeasure: item.unitOfMeasure || 'units',
          estimatedUnitPrice: price
        }]
      });

      const directPurchase = await postApi('/api/direct-purchases', {
        sellerId: Number(item.sellerId),
        requirementId: (requirement as any)?.id,
        totalAmount
      });

      onActionCreated(item, {
        purchase: {
          id: (directPurchase as any)?.id,
          status: (directPurchase as any)?.status || 'REQUESTED',
          purchaseNumber: (directPurchase as any)?.purchaseNumber
        }
      });
      toast.success('Direct purchase request submitted successfully! Go to Buyer Hub > Direct Purchase to view.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit direct purchase request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestQuote = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required.');
      return;
    }
    setSubmitting(true);
    try {
      const quote = await postApi('/api/quote-requests', {
        sellerId: Number(item.sellerId),
        subject: subject.trim(),
        message: message.trim(),
        documentUrl: docUrl.trim() || undefined,
        estimatedValue: estimatedValue !== '' ? Number(estimatedValue) : undefined
      });
      onActionCreated(item, {
        rfq: {
          id: (quote as any)?.id,
          status: (quote as any)?.status || (quote as any)?.statusEnum || 'sent',
          subject: (quote as any)?.subject || subject.trim()
        }
      });
      toast.success('RFQ submitted successfully! Go to Buyer Hub > RFQ to track bids.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit quote request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-[#059669]" />
            <span className="text-sm font-black uppercase tracking-widest text-neutral-900">
              Procure: {item.name}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-105 transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs switcher */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('purchase')}
            className={cn(
              "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all",
              activeTab === 'purchase'
                ? "bg-white text-emerald-700 shadow-sm border border-slate-150"
                : "text-slate-500 hover:bg-slate-100"
            )}
          >
            Direct Purchase
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bid')}
            className={cn(
              "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all",
              activeTab === 'bid'
                ? "bg-white text-emerald-700 shadow-sm border border-slate-150"
                : "text-slate-500 hover:bg-slate-100"
            )}
          >
            Request Bid (RFQ)
          </button>
        </div>

        <div className="p-6">
          {(actionState?.purchase || actionState?.rfq) && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Current Status</p>
              <p className="mt-1 text-xs font-bold text-emerald-900">
                {actionState.purchase
                  ? `Direct purchase ${String(actionState.purchase.status || 'requested').replace(/_/g, ' ')}${actionState.purchase.purchaseNumber ? ` (${actionState.purchase.purchaseNumber})` : ''}`
                  : `RFQ ${String(actionState.rfq?.status || 'sent').replace(/_/g, ' ')}${actionState.rfq?.subject ? `: ${actionState.rfq.subject}` : ''}`}
              </p>
            </div>
          )}
          {activeTab === 'purchase' ? (
            <form onSubmit={handleDirectPurchase} className="space-y-4">
              <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                  <span>Unit Price</span>
                  <span className="text-emerald-700 font-black">{formatCurrency(price)}</span>
                </div>
                {item.unitOfMeasure && (
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                    <span>UOM</span>
                    <span className="text-slate-700">{item.unitOfMeasure}</span>
                  </div>
                )}
                {item.itemCondition && (
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                    <span>Condition</span>
                    <span className="text-slate-700">{ITEM_CONDITIONS.find(c => c.value === item.itemCondition)?.label || item.itemCondition.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {item.seller && (
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                    <span>Seller</span>
                    <span className="text-slate-700 truncate max-w-[200px]">{item.seller.name}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Quantity To Purchase
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Est. Value</h4>
                  <p className="text-lg font-black text-emerald-700">{formatCurrency(totalAmount)}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose} className="h-9 px-3.5 text-xs font-black uppercase tracking-wider border-slate-200">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="h-9 px-5 text-xs font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700">
                    {submitting ? 'Submitting...' : 'Confirm Purchase'}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestQuote} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">RFQ Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject of quote request"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Message for Seller</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide precise details, quantity required, technical specs, etc..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Amount / Value (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 50000"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Attach Document (Optional)</label>
                <div className={`relative flex items-center justify-between w-full border border-dashed rounded-lg p-3 transition-all ${docUrl ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md ${docUrl ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                      <Paperclip className="h-3.5 w-3.5" />
                    </div>
                    <span className={`text-xs font-semibold ${docUrl ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {docUrl ? 'Document attached' : 'Attach requirement PDF / DOC'}
                    </span>
                  </div>
                  <input
                    type="file"
                    id="rfq-quote-doc"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={handleUploadQuoteDoc}
                    disabled={isUploadingDoc}
                  />
                  <label
                    htmlFor="rfq-quote-doc"
                    className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide cursor-pointer transition-all ${docUrl
                      ? 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                  >
                    {isUploadingDoc ? 'Uploading...' : docUrl ? 'Change' : 'Upload'}
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} className="h-9 px-3.5 text-xs font-black uppercase tracking-wider border-slate-200">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="h-9 px-5 text-xs font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700">
                  {submitting ? 'Submitting...' : 'Submit RFQ'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function SellerProfileModal({ seller, loading, onClose }: { seller: any; loading: boolean; onClose: () => void }) {
  const profile = seller?.sellerProfile || seller?.buyerProfile || seller || {};
  const offices = normalizeList<any>(seller?.sellerProfile?.offices || seller?.offices || profile.offices);
  const categories = normalizeList<string>(profile.productCategories || profile.categories);
  const primaryOffice = offices[0] || {};
  const location = [profile.city || primaryOffice.city, profile.state || primaryOffice.state].filter(Boolean).join(', ') || profile.location || primaryOffice.address || 'Not available';
  const pan = profile.pan || profile.panMasked || seller?.pan || 'Not available';
  const gst = profile.gst || profile.gstMasked || primaryOffice.gstNumber || seller?.gst || 'Not available';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[#059669]">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#059669]">Seller Profile</p>
              <h2 className="truncate text-lg font-black text-neutral-900">{profile.businessName || profile.companyName || seller?.name || 'Seller'}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-105 transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
              Loading seller profile...
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                  {String(seller?.onboardingStatus || profile?.onboardingStatus || 'approved').replace(/_/g, ' ')}
                </span>
                {profile.organizationType && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                    {profile.organizationType}
                  </span>
                )}
                {profile.msmeCategory && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                    {profile.msmeCategory}
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SellerInfoBox icon={Mail} label="Email" value={seller?.email || profile?.email || 'Not available'} />
                <SellerInfoBox icon={Building2} label="Business Name" value={profile.businessName || profile.companyName || seller?.name || 'Not available'} />
                <SellerInfoBox icon={MapPin} label="Location" value={location} />
                <SellerInfoBox icon={CalendarDays} label="Incorporated" value={profile.dateOfIncorporation ? new Date(profile.dateOfIncorporation).toLocaleDateString() : 'Not available'} />
                <SellerInfoBox icon={ShieldCheck} label="PAN" value={pan} />
                <SellerInfoBox icon={FileText} label="GST" value={gst} />
              </div>

              {categories.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Procurement Categories</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categories.map(category => (
                      <span key={category} className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">{category}</span>
                    ))}
                  </div>
                </div>
              )}

              {offices.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Office Locations</h4>
                  <div className="mt-2 space-y-2">
                    {offices.slice(0, 3).map((office, index) => (
                      <div key={office.id || index} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-black text-neutral-900">{office.name || office.type || `Office ${index + 1}`}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">{[office.city, office.state, office.pincode].filter(Boolean).join(', ') || office.address || 'Address not available'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SellerInfoBox({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 break-words text-xs font-bold text-slate-700">{value}</p>
        </div>
      </div>
    </div>
  );
}
