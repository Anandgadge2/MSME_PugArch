import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, IndianRupee, PackagePlus, PackageSearch, Plus, RefreshCw, Search, Settings2, Store, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input, Select } from '../../../components/ui/input';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../lib/utils';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency } from '../../shared/format';
import type { CatalogueItemDto } from '../../shared/types';
import { catalogueApi } from '../api';

type CatalogueMode = 'buyer' | 'seller' | 'admin';
type ItemKind = 'product' | 'service';
type FilterKind = 'all' | ItemKind;
type CatalogueRecord = CatalogueItemDto & { itemKind: ItemKind };

const blankForm = {
  name: '',
  description: '',
  price: '',
  hsnCode: '',
  unitOfMeasure: '',
  basePrice: '',
  pricingModel: 'FIXED',
  serviceArea: '',
  status: 'ACTIVE'
};

export default function CataloguePage({ mode = 'buyer' }: { mode?: CatalogueMode }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<CatalogueRecord[]>([]);
  const [services, setServices] = useState<CatalogueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<FilterKind>('all');
  const [formKind, setFormKind] = useState<ItemKind>('product');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);

  const sellerApproved = mode !== 'seller' || ['approved_for_procurement', 'approved'].includes(String(user?.onboardingStatus));

  const loadCatalogue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRows, serviceRows] = await Promise.all([
        mode === 'seller' ? catalogueApi.sellerProducts() : mode === 'admin' ? catalogueApi.adminProducts() : catalogueApi.searchProducts(),
        mode === 'seller' ? catalogueApi.sellerServices() : mode === 'admin' ? catalogueApi.adminServices() : catalogueApi.searchServices()
      ]);
      setProducts(productRows.map(item => ({ ...item, itemKind: 'product' as const })));
      setServices(serviceRows.map(item => ({ ...item, itemKind: 'service' as const })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load catalogue');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const data = useMemo(() => [...products, ...services], [products, services]);
  const categories = useMemo(() => Array.from(new Set(data.map(item => item.category?.name).filter(Boolean) as string[])).sort(), [data]);
  const statuses = useMemo(() => Array.from(new Set(data.map(item => item.status).filter(Boolean) as string[])).sort(), [data]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return data.filter(item => {
      const price = Number(item.price || item.basePrice || 0);
      const haystack = [item.name, item.description, item.category?.name, item.seller?.name, item.seller?.email, item.itemKind].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesKind = kindFilter === 'all' || item.itemKind === kindFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;
      const matchesCategory = !categoryFilter || item.category?.name === categoryFilter;
      const matchesPrice = !priceFilter || (priceFilter === 'high' ? price >= 10000 : priceFilter === 'mid' ? price >= 1000 && price < 10000 : price < 1000);
      return matchesSearch && matchesKind && matchesStatus && matchesCategory && matchesPrice;
    });
  }, [categoryFilter, data, kindFilter, priceFilter, searchTerm, statusFilter]);

  const averageValue = filtered.length ? filtered.reduce((sum, item) => sum + Number(item.price || item.basePrice || 0), 0) / filtered.length : 0;

  const updateForm = (field: keyof typeof blankForm, value: string) => setForm(current => ({ ...current, [field]: value }));

  const openCreateForm = (kind: ItemKind) => {
    setFormKind(kind);
    setShowForm(true);
    setForm(blankForm);
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!sellerApproved) {
      toast.error('Your seller account must be approved before adding catalogue items.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Enter a catalogue name.');
      return;
    }
    setSaving(true);
    try {
      if (formKind === 'product') {
        await catalogueApi.createProduct({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          price: form.price ? Number(form.price) : undefined,
          hsnCode: form.hsnCode.trim() || undefined,
          unitOfMeasure: form.unitOfMeasure.trim() || undefined,
          currency: 'INR',
          status: form.status
        });
        toast.success('Product added to your catalogue.');
      } else {
        await catalogueApi.createService({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          basePrice: form.basePrice ? Number(form.basePrice) : undefined,
          pricingModel: form.pricingModel,
          serviceArea: form.serviceArea.trim() || undefined,
          currency: 'INR',
          status: form.status
        });
        toast.success('Service added to your catalogue.');
      }
      setShowForm(false);
      setForm(blankForm);
      await loadCatalogue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save catalogue item');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading catalogue..." />;

  const title = mode === 'seller' ? 'Seller Catalogue' : mode === 'admin' ? 'Catalogue Review' : 'Buyer Catalogue';
  const subtitle = mode === 'seller'
    ? 'Create and manage products and services after seller approval.'
    : mode === 'admin'
      ? 'Review every product and service listed by sellers.'
      : 'Search approved products and services from active sellers.';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">{title}</p>
          <h1 className="text-2xl font-black text-slate-950">Catalogue</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === 'seller' && (
            <>
              <Button disabled={!sellerApproved} onClick={() => openCreateForm('product')} className="h-10 rounded-lg text-xs font-black uppercase">
                <PackagePlus className="mr-2 h-4 w-4" />Product
              </Button>
              <Button disabled={!sellerApproved} onClick={() => openCreateForm('service')} variant="outline" className="h-10 rounded-lg text-xs font-black uppercase">
                <Wrench className="mr-2 h-4 w-4" />Service
              </Button>
            </>
          )}
          <Button variant="outline" onClick={loadCatalogue} className="h-10 rounded-lg text-xs font-black uppercase">
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
        </div>
      </div>

      {mode === 'seller' && !sellerApproved && (
        <InlineError message="Catalogue creation is locked until admin approves your seller onboarding. You can view your catalogue, but adding or changing products and services is disabled." />
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Total Items" value={filtered.length} icon={Boxes} />
        <Metric label="Products" value={products.length} icon={PackageSearch} />
        <Metric label="Services" value={services.length} icon={Wrench} />
        <Metric label="Avg. Value" value={formatCurrency(averageValue)} icon={IndianRupee} />
      </div>

      {showForm && mode === 'seller' && (
        <CatalogueForm
          form={form}
          kind={formKind}
          saving={saving}
          onCancel={() => setShowForm(false)}
          onSubmit={submitForm}
          onChange={updateForm}
        />
      )}

      {error && <InlineError message={error} onRetry={loadCatalogue} />}

      <Card>
        <CardContent className="grid gap-3 p-4 xl:grid-cols-[1fr_150px_170px_170px_160px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search name, seller, category..." className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
          </div>
          <select value={kindFilter} onChange={event => setKindFilter(event.target.value as FilterKind)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20">
            <option value="all">All types</option>
            <option value="product">Products</option>
            <option value="service">Services</option>
          </select>
          <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20">
            <option value="">All categories</option>
            {categories.map(category => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20">
            <option value="">All statuses</option>
            {statuses.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={priceFilter} onChange={event => setPriceFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20">
            <option value="">All prices</option>
            <option value="high">Above Rs. 10k</option>
            <option value="mid">Rs. 1k to 10k</option>
            <option value="low">Below Rs. 1k</option>
          </select>
        </CardContent>
      </Card>

      {filtered.length === 0 ? <EmptyState title="No catalogue items" /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(item => <CatalogueCard key={`${item.itemKind}-${item.id}`} item={item} mode={mode} />)}
        </div>
      )}
    </div>
  );
}

function CatalogueForm({ form, kind, saving, onCancel, onSubmit, onChange }: {
  form: typeof blankForm;
  kind: ItemKind;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
  onChange: (field: keyof typeof blankForm, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-black">{kind === 'product' ? 'Add Product' : 'Add Service'}</CardTitle>
        <Badge>{kind}</Badge>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 lg:grid-cols-2">
          <Input label={`${kind === 'product' ? 'Product' : 'Service'} Name`} value={form.name} onChange={event => onChange('name', event.target.value)} required />
          <Select label="Visibility Status" value={form.status} onChange={event => onChange('status', event.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Description</label>
            <textarea value={form.description} onChange={event => onChange('description', event.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 bg-slate-100/50 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {kind === 'product' ? (
            <>
              <Input label="Price" type="number" min="0" value={form.price} onChange={event => onChange('price', event.target.value)} />
              <Input label="Unit Of Measure" value={form.unitOfMeasure} onChange={event => onChange('unitOfMeasure', event.target.value)} placeholder="piece, kg, box" />
              <Input label="HSN Code" value={form.hsnCode} onChange={event => onChange('hsnCode', event.target.value)} />
            </>
          ) : (
            <>
              <Input label="Base Price" type="number" min="0" value={form.basePrice} onChange={event => onChange('basePrice', event.target.value)} />
              <Select label="Pricing Model" value={form.pricingModel} onChange={event => onChange('pricingModel', event.target.value)}>
                <option value="FIXED">Fixed</option>
                <option value="HOURLY">Hourly</option>
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
                <option value="PER_PROJECT">Per Project</option>
                <option value="CUSTOM">Custom</option>
              </Select>
              <Input label="Service Area" value={form.serviceArea} onChange={event => onChange('serviceArea', event.target.value)} placeholder="City, state, India" />
            </>
          )}
          <div className="flex justify-end gap-2 lg:col-span-2">
            <Button type="button" variant="outline" onClick={onCancel} className="h-10 rounded-lg text-xs font-black uppercase">Cancel</Button>
            <Button type="submit" disabled={saving} className="h-10 rounded-lg text-xs font-black uppercase">
              <Plus className="mr-2 h-4 w-4" />{saving ? 'Saving...' : `Create ${kind}`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CatalogueCard({ item, mode }: { item: CatalogueRecord; mode: CatalogueMode }) {
  const value = item.itemKind === 'product' ? item.price : item.basePrice;
  const status = item.status || 'DRAFT';
  const statusVariant = status === 'ACTIVE' ? 'success' : status === 'ARCHIVED' || status === 'INACTIVE' ? 'warning' : 'default';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white', item.itemKind === 'product' ? 'bg-[#12335f]' : 'bg-emerald-700')}>
            {item.itemKind === 'product' ? <PackageSearch className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="break-words text-sm font-black text-slate-950">{item.name}</h3>
              <Badge variant={statusVariant}>{status.replace(/_/g, ' ')}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{item.description || 'No description provided'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="text-xs font-black text-[#12335f]">{formatCurrency(value)}</p>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{item.itemKind}</span>
              {item.category?.name && <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-[#12335f]">{item.category.name}</span>}
              {item.itemKind === 'service' && item.pricingModel && <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">{item.pricingModel.replace(/_/g, ' ')}</span>}
            </div>
            {(mode === 'buyer' || mode === 'admin') && item.seller?.name && (
              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-500">
                <Store className="h-3.5 w-3.5" />
                <span className="truncate">{item.seller.name}</span>
                {mode === 'admin' && item.seller.onboardingStatus && <span className="truncate text-slate-400">({item.seller.onboardingStatus.replace(/_/g, ' ')})</span>}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#12335f]">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
