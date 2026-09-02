import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { api, unwrapApiData, readJsonResponse, BASE_URL } from '../../lib/api';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Building2,
  Store,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  ShoppingCart,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Bell,
  Search,
  Users,
  FileText,
  User as UserIcon,
  Settings,
  ClipboardCheck,
  Truck,
  CreditCard,
  Landmark,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  FileSearch,
  Info,
  Check,
  CheckSquare,
  UserPlus,
  PlusCircle,
  ClipboardList,
  BookOpen,
  Images,
  Trophy,
  Gavel,
  UsersRound,
  MessageSquare,
  Mail,
  MapPin,
  UserCheck,
  Globe,
  RotateCcw,
  Layers
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { routeForNotification, type PortalNotification } from '../../lib/notifications';
import { isShgUser, getSellerPortalPath } from '../../lib/shg';
import { useMarketplaceCart } from '../../features/marketplace/hooks/useMarketplaceCart';

interface SidebarItem {
  label: string;
  path?: string;
  icon: any;
  roles: string[];
  permission?: string;
  featureCode?: string;
  children?: SidebarItem[];
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onHoverChange?: (isHovered: boolean) => void;
}

const preloadRegistry: Record<string, () => Promise<any>> = {
  '/dashboard': () => import('../../views/Dashboard'),
  '/master-admin': () => import('../../features/masterAdmin/pages/MasterAdminPage'),
  // LEGACY: /buyer/create-bid now shows LegacyNoticePage → redirects to unified wizard
  '/buyer/create-bid': () => import('../../features/procurementWizard/pages/CreateProcurementPage'),
  '/buyer/procurement/create': () => import('../../features/procurementWizard/pages/CreateProcurementPage'),
  '/buyer/procurement/drafts': () => import('../../features/procurementWizard/pages/ProcurementDraftsPage'),
  
  '/seller/opportunities': () => import('../../features/sellerOpportunities/pages/SellerOpportunitiesPage'),
  
  '/seller/procurement/events': () => import('../../features/sellerOpportunities/pages/SellerEventListPage'),
  '/orders': () => import('../../features/procurementBid/pages/ProcurementOrdersPage'),
  '/orders/delivery-confirmation': () => import('../../features/grn/pages/GrnListPage'),
  '/orders/tracking': () => import('../../views/ParcelTracking'),
  '/payments/invoices': () => Promise.resolve(),
  '/payments/transactions': () => Promise.resolve(),
  '/payments/escrow': () => import('../../features/escrow/pages/EscrowPage'),
  '/admin/onboarding': () => import('../../views/AdminOnboarding'),
  '/shg/onboarding': () => import('../../views/ShgOnboarding'),
  '/shg/dashboard': () => import('../../views/ShgOnboarding'),
  '/seller/marketplace': () => Promise.resolve(),
  '/seller/catalogue': () => Promise.resolve(),
  '/buyer/marketplace': () => Promise.resolve(),
  
  
  
  '/seller/orders': () => Promise.resolve(),
  '/buyer/orders': () => Promise.resolve(),
  '/seller/invoices': () => Promise.resolve(),
  '/buyer/invoices': () => Promise.resolve(),
  '/seller/delivery': () => import('../../views/ParcelTracking'),
  '/seller/delivery-management': () => import('../../features/sellerDelivery/pages/SellerDeliveryManagementPage'),
  '/seller/ratings': () => import('../../features/ratings/pages/RatingsPage'),
  '/buyer/vendors': () => import('../../views/Vendors'),
  '/buyer/saved-suppliers': () => import('../../features/marketplace/pages/SavedSuppliersPage'),
  '/buyer/messages': () => import('../../features/messages/pages/MessagesPage'),
  '/seller/messages': () => import('../../features/messages/pages/MessagesPage'),
  
  '/buyer/procurement': () => import('../../features/procurement/pages/BuyerProcurementHub'),
  '/buyer/my-procurements': () => import('../../features/procurement/pages/MyProcurementsPage'),
  '/buyer/procurement/checkout': () => import('../../features/procurementCheckoutV2/pages/ProcurementCheckoutPage'),
  '/buyer/direct-purchase/orders': () => import('../../features/directPurchase/pages/DirectPurchasePage'),
  '/buyer/address-book': () => import('../../features/directPurchase/pages/AddressBookPage'),
  
  '/reports': () => import('../../features/reports/pages/RoleReportsPage'),
  
  '/reverse-auctions/create': () => import('../../features/reverseAuctions/pages/ReverseAuctionCreatePage'),
  '/seller/direct-purchase': () => import('../../features/directPurchase/pages/DirectPurchasePage'),
  '/buyer/tracking': () => import('../../views/ParcelTracking'),
  '/admin/delivery': () => import('../../features/delivery/pages/DeliveryListPage'),
  '/admin/reports': () => import('../../views/MISReports'),
  '/admin/banners': () => import('../../features/banners/pages/AdminBannerManagementPage'),
  '/admin/monthly-rankings': () => import('../../features/banners/pages/MonthlyRankingsAdminPage'),
  '/my-org/banner-eligibility': () => import('../../features/banners/pages/OrganizationBannerEligibilityPage'),
  '/cart': () => import('../../features/cart/pages/CartPage'),
  
  
  
  '/grn': () => import('../../features/grn/pages/GrnListPage'),
  '/payments': () => Promise.resolve(),
  '/escrow': () => import('../../features/escrow/pages/EscrowPage'),
  '/org/team': () => import('../../features/orgTeam/pages/TeamManagementPage'),
  '/buyer/disputes': () => import('../../features/disputes/pages/DisputesPage'),
  '/seller/disputes': () => import('../../features/disputes/pages/DisputesPage'),
  '/admin/disputes': () => import('../../features/disputes/pages/DisputesPage'),
  '/settings/notifications': () => import('../../features/settings/pages/NotificationPrefsPage'),
  '/admin/users': () => import('../../features/admin/pages/AdminRecordsPage'),
  '/admin/marketplace': () => Promise.resolve(),
  '/admin/organizations': () => import('../../views/OrganizationManagement'),
  '/admin/rbac': () => import('../../views/RbacPanel'),
  '/admin/fraud-alerts': () => import('../../features/fraudAlerts/pages/FraudAlertsPage'),
  '/admin/compliance-rules': () => import('../../features/compliance/pages/ComplianceRulesPage'),
  '/seller/onboarding': () => import('../../views/SellerOnboarding'),
  '/buyer/onboarding': () => import('../../views/BuyerOnboarding'),
  '/seller/settings': () => import('../../views/SellerSettings'),
  '/buyer/profile': () => import('../../views/BuyerProfile'),
  // '/user-guide': () => import('../../views/PortalDocumentation'),
  '/help': () => import('../../views/HelpPage'),
  '/profile': () => import('../../views/Profile'),
};

const preloadRoute = (path: string) => {
  const load = preloadRegistry[path.split('?')[0]];
  if (load) {
    load().catch((err) => {
      console.warn(`Failed to preload chunk for path ${path}:`, err);
    });
  }
};

const shouldPrefetchNavigation = () => {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  };
  if (nav.connection?.saveData) return false;
  if (nav.connection?.effectiveType && /(^2g$|slow-2g)/i.test(nav.connection.effectiveType)) return false;
  return window.matchMedia('(min-width: 1024px)').matches;
};

const collectPaths = (items: SidebarItem[]) =>
  items.flatMap(item => item.children?.length ? collectPaths(item.children) : item.path ? [item.path] : []);

const SIDEBAR_GROUP_STATE_KEY = 'msme-sidebar-open-groups';
type SidebarGroupState = Record<string, boolean | undefined>;

const getSidebarGroupId = (label: string) =>
  `sidebar-group-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const HIGH_PRIORITY_PREFETCH_ROUTES = [
  '/dashboard',
  '/master-admin',
  '/admin/users',
  '/admin/organizations',
  '/admin/onboarding',
  '/admin/reports',
  '/admin/banners',
  '/admin/monthly-rankings',
  '/payments',
  '/escrow',
  '/settings/notifications'
] as const;

const ALL_MENU_PATHS = [
  '/buyer/procurement/create',
  '/buyer/procurement/drafts',
  '/buyer/procurement/responses',
  '/buyer/procurement/approvals',
  '/seller/procurement/events',
  '/orders/delivery-confirmation',
  '/orders/tracking',
  '/grn',
  '/admin/marketplace/home-sections'
];

const isSidebarRouteActive = (targetPath: string | undefined, pathname?: string | null, currentPathWithQuery?: string) => {
  if (!targetPath || !pathname) return false;
  const [targetBase] = targetPath.split('?');
  if (targetPath.includes('?')) return currentPathWithQuery === targetPath;
  if (targetBase === '/orders') return pathname === '/orders' || pathname === '/seller/orders' || pathname === '/buyer/orders';

  // Prevent parent routes (e.g. /buyer/procurement) from matching active when a distinct sub-item menu path is current
  const isPrefixOfOtherMenu = ALL_MENU_PATHS.some(menuPath => 
    menuPath.startsWith(`${targetBase}/`) && pathname === menuPath
  );
  if (isPrefixOfOtherMenu) {
    return false;
  }

  return currentPathWithQuery === targetBase || Boolean(targetBase && pathname.startsWith(`${targetBase}/`));
};

const SidebarNavLink = memo(function SidebarNavLink({
  item,
  isActive,
  isCollapsed,
  onClose,
  count
}: {
  item: SidebarItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  count?: number;
}) {
  const path = item.path;
  const handlePreload = useCallback(() => {
    if (path) preloadRoute(path);
  }, [path]);
  const handlePointerDown = useCallback(() => {
    if (path) preloadRoute(path);
  }, [path]);
  const Icon = item.icon;
  if (!path) return null;

  return (
    <Link
      href={path}
      scroll={false}
      onClick={onClose}
      onPointerDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onMouseEnter={handlePreload}
      onFocus={handlePreload}
      title={isCollapsed ? item.label : undefined}
      className={cn("relative flex items-center gap-3 rounded-md transition-all duration-200 group",
        isCollapsed ? "lg:justify-center lg:px-0 px-3 py-2.5 h-11" : "px-3 py-2.5",
        isActive
          ? "bg-white/10 text-white"
          : "text-white/70 hover:bg-white/5 hover:text-white"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r bg-[#c8a45c]" aria-hidden="true" />
      )}
      <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-[#c8a45c]" : "text-white/60 group-hover:text-white")} />
      <span className={cn("text-sm font-medium truncate", isCollapsed && "lg:hidden")}>{item.label}</span>
      {count !== undefined && count > 0 && !isCollapsed && (
        <span className={cn(
          "ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[20px] h-[20px] transition-colors duration-200",
          isActive ? "bg-white text-[#0b2447] shadow-sm" : "bg-white/10 text-white/70 group-hover:bg-white/20 group-hover:text-white"
        )}>
          {count}
        </span>
      )}
      {isActive && (count === undefined || count <= 0) && <ChevronRight className={cn("ml-auto h-3 w-3 text-[#c8a45c]", isCollapsed && "lg:hidden")} />}
    </Link>
  );
});

const SidebarNavGroup = memo(function SidebarNavGroup({
  item,
  pathname,
  currentPathWithQuery,
  isCollapsed,
  isOpen,
  onToggle,
  onClose,
  counts
}: {
  item: SidebarItem;
  pathname?: string | null;
  currentPathWithQuery?: string;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  counts?: Record<string, number>;
}) {
  const Icon = item.icon;
  const children = item.children || [];
  const groupId = getSidebarGroupId(item.label);
  const active = children.some(child => isSidebarRouteActive(child.path, pathname, currentPathWithQuery));

  if (!children.length) {
    return item.path ? (
      <SidebarNavLink item={item} isActive={isSidebarRouteActive(item.path, pathname, currentPathWithQuery)} isCollapsed={isCollapsed} onClose={onClose} count={counts?.[item.path]} />
    ) : null;
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={groupId}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.16em] transition-colors",
          active ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/5 hover:text-white",
          isCollapsed && "lg:justify-center lg:px-0"
        )}
        title={isCollapsed ? item.label : undefined}
      >
        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#c8a45c]" : "text-white/45")} />
        <span className={cn(isCollapsed && "lg:hidden")}>{item.label}</span>
        <ChevronDown className={cn("ml-auto h-3 w-3 transition-transform", isOpen && "rotate-180", isCollapsed && "lg:hidden")} />
      </button>
      {isOpen && (
        <div id={groupId} className={cn("space-y-1", !isCollapsed && "pl-3")}>
          {children.map(child => (
            <SidebarNavLink
              key={`${item.label}-${child.label}`}
              item={child}
              isActive={isSidebarRouteActive(child.path, pathname, currentPathWithQuery)}
              isCollapsed={isCollapsed}
              onClose={onClose}
              count={child.path ? counts?.[child.path] : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
});

import { useOrgRole, usePermissions, type OrgStatus } from '../../hooks/useOrgRole';

export function getResolvedOrgName(user: any, orgStatus?: OrgStatus | null): string {
  if (!user) return '';
  const reg = (user.registrationDetails || {}) as Record<string, any>;
  return (
    orgStatus?.organization?.organizationName ||
    user.organization?.organizationName ||
    user.sellerProfile?.businessName ||
    user.sellerProfile?.companyName ||
    user.sellerProfile?.nameAsInPan ||
    user.buyerProfile?.departmentName ||
    user.buyerProfile?.organizationName ||
    user.buyerProfile?.entityName ||
    user.buyerProfile?.companyName ||
    user.shgProfile?.groupName ||
    user.shgProfile?.shgName ||
    reg.businessName ||
    reg.companyName ||
    reg.organizationName ||
    reg.organisation ||
    reg.enterpriseName ||
    reg.legalName ||
    reg.tradeName ||
    ''
  );
}

export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse, onHoverChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const { orgStatus } = useOrgRole();
  const orgName = useMemo(() => getResolvedOrgName(user, orgStatus), [user, orgStatus]);
  const isShgAccount = isShgUser(user);
  const { hasPermission: checkUserPermission } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPathWithQuery = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);
  const [openGroups, setOpenGroups] = useState<SidebarGroupState>({});
  const [isHovered, setIsHovered] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onHoverChange?.(isHovered);
  }, [isHovered, onHoverChange]);

  const effectivelyCollapsed = isCollapsed && !isHovered;

  const { data: countsData } = useQuery({
    queryKey: ['navigation-counts'],
    queryFn: async () => {
      const res = await api.get('/api/navigation/summary');
      const body = await readJsonResponse(res);
      const data = unwrapApiData(body);
      if (!data) return {} as Record<string, number>;

      const rfqsCount = Number(data.rfqsCount || 0);
      const rfpsCount = Number(data.rfpsCount || 0);
      const openTendersCount = Number(data.openTendersCount || 0);
      const invitationsCount = Number(data.invitationsCount || 0);
      const auctionsCount = Number(data.auctionsCount || 0);
      const rateContractsCount = Number(data.rateContractsCount || 0);

      const allCount = rfqsCount + rfpsCount + openTendersCount + invitationsCount + auctionsCount + rateContractsCount;

      return {
        '/seller/opportunities/rfqs': rfqsCount,
        '/seller/opportunities/rfps': rfpsCount,
        '/seller/opportunities/open-tenders': openTendersCount,
        '/seller/opportunities/invitations': invitationsCount,
        '/seller/opportunities/auctions': auctionsCount,
        '/seller/opportunities/rate-contracts': rateContractsCount,
        '/seller/bids': Number(data.bidsCount || 0),
        '/shg/bids': Number(data.bidsCount || 0),
        '/shg/opportunities': allCount,
        '/shg/opportunities/rfqs': rfqsCount,
        '/shg/opportunities/rfps': rfpsCount,
        '/shg/opportunities/open-tenders': openTendersCount,
        '/shg/opportunities/invitations': invitationsCount,
        '/shg/opportunities/auctions': auctionsCount,
        '/shg/opportunities/rate-contracts': rateContractsCount
      };
    },
    enabled: user?.role === 'seller' || user?.role === 'shg' || isShgAccount,
    staleTime: 30000,
    refetchInterval: 15000,
  });

  const counts = countsData || {};

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('sidebarScrollPosition');
      if (saved && navRef.current) {
        navRef.current.scrollTop = Number(saved);
      }

      const savedGroups = localStorage.getItem(SIDEBAR_GROUP_STATE_KEY);
      if (savedGroups) {
        try {
          const parsedGroups = JSON.parse(savedGroups);
          if (parsedGroups && typeof parsedGroups === 'object' && !Array.isArray(parsedGroups)) {
            setOpenGroups(parsedGroups);
          }
        } catch {
          localStorage.removeItem(SIDEBAR_GROUP_STATE_KEY);
        }
      }
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (navRef.current) {
      sessionStorage.setItem('sidebarScrollPosition', String(navRef.current.scrollTop));
    }
  }, []);

  // Close mobile drawer when pressing Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleLogout = useCallback(() => {
    logout('/');
  }, [logout]);
  const accountLabel = isShgAccount ? 'SHG' : user?.role || 'user';

  const navItems: SidebarItem[] = useMemo(() => [
    { label: 'Dashboard', path: isShgAccount ? '/shg/dashboard' : '/dashboard', icon: LayoutDashboard, roles: ['seller', 'buyer', 'admin', 'shg'], permission: 'dashboard.view' },
    { label: 'Master Console', path: '/master-admin', icon: ShieldCheck, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Organizations', path: '/master-admin/organizations', icon: Store, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Users & Roles', path: '/master-admin/users', icon: UsersRound, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Procurement Control', path: '/master-admin/procurement', icon: Gavel, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Marketplace Control', path: '/master-admin/marketplace', icon: ShoppingCart, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Orders & Delivery', path: '/master-admin/orders', icon: Truck, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Payments & Escrow', path: '/master-admin/payments', icon: CreditCard, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Reports & Data Export', path: '/master-admin/exports', icon: BarChart3, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Feature Controls', path: '/master-admin/features', icon: CheckSquare, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Branding & Homepage', path: '/master-admin/branding', icon: Images, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Email Setup', path: '/master-admin/email', icon: Mail, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Audit Logs', path: '/master-admin/audit', icon: FileText, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Security & Access', path: '/master-admin/security', icon: ShieldCheck, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Settings', path: '/master-admin/settings', icon: Settings, roles: ['master_admin'], permission: 'company.manage' },
    { label: 'Approvals', icon: ClipboardCheck, roles: ['admin'], children: [
      { label: 'Stakeholder Approvals', path: '/admin/onboarding', icon: ShieldCheck, roles: ['admin'] },
      { label: 'Tender Approvals', path: '/admin/bids', icon: FileText, roles: ['admin'], featureCode: 'admin-bid-approval' },
      { label: 'Final Award Approvals', path: '/admin/procurement-orders', icon: Trophy, roles: ['admin'] },
    ] },
    { label: 'Monitoring', icon: FileSearch, roles: ['admin'], children: [
      { label: 'Orders & Delivery', path: '/admin/delivery', icon: Truck, roles: ['admin'] },
      { label: 'Payments & Escrow', path: '/payments/transactions', icon: CreditCard, roles: ['admin'] },
      { label: 'Fraud Alerts', path: '/admin/fraud-alerts', icon: AlertTriangle, roles: ['admin'] },
    ] },
    { label: 'Marketplace', icon: ShoppingCart, roles: ['admin'], children: [
      { label: 'Catalogue Review', path: '/admin/marketplace', icon: ShoppingCart, roles: ['admin'] },
      { label: 'Categories', path: '/admin/categories', icon: ClipboardList, roles: ['admin'] },
      { label: 'Homepage Sections', path: '/admin/marketplace/home-sections', icon: Images, roles: ['admin'] },
      { label: 'Banners', path: '/admin/banners', icon: Images, roles: ['admin'] },
      { label: 'Monthly Rankings', path: '/admin/monthly-rankings', icon: Trophy, roles: ['admin'] },
    ] },
    { label: 'Organizations', icon: Building2, roles: ['admin'], children: [
      { label: 'Users', path: '/admin/users', icon: Users, roles: ['admin'] },
      { label: 'Organizations', path: '/admin/organizations', icon: Building2, roles: ['admin'] },
      { label: 'Team & RBAC', path: '/admin/rbac', icon: ShieldCheck, roles: ['admin'], featureCode: 'role-management' },
    ] },
    { label: 'Reports', path: '/admin/reports', icon: BarChart3, roles: ['admin'], featureCode: 'reports-mis' },
    { label: 'Compliance', path: '/admin/compliance-rules', icon: ShieldCheck, roles: ['admin'] },
    // Buyer Marketplace
    { label: 'Marketplace', icon: ShoppingCart, roles: ['buyer'], children: [
      { label: 'Products & Services', path: '/buyer/marketplace', icon: Store, roles: ['buyer'], permission: 'marketplace.view' },
      { label: 'Cart', path: '/cart', icon: ShoppingCart, roles: ['buyer'], permission: 'cart.view' }
    ] },
    // Buyer Procurement
    { label: 'Procurement', icon: ClipboardCheck, roles: ['buyer'], children: [
      { label: 'Create Procurement', path: '/buyer/procurement/create', icon: PlusCircle, roles: ['buyer'], permission: 'requirement.create' },
      { label: 'My Procurements', path: '/buyer/my-procurements', icon: ClipboardList, roles: ['buyer'], permission: 'requirement.view' },
      { label: 'Draft Procurements', path: '/buyer/procurement/drafts', icon: FileText, roles: ['buyer'], permission: 'requirement.create' },
      { label: 'Supplier Responses', path: '/buyer/procurement/responses', icon: FileText, roles: ['buyer'], permission: 'requirement.view' }
    ] },
    // Buyer Orders
    { label: 'Orders', icon: Truck, roles: ['buyer'], children: [
      { label: 'Purchase Orders', path: '/orders', icon: ShoppingCart, roles: ['buyer'], permission: 'purchase_order.view' },
      { label: 'Goods Receipt Notes (GRN)', path: '/grn', icon: ClipboardCheck, roles: ['buyer'], permission: 'grn.view' },
      { label: 'Repeat Orders', path: '/buyer/repeat-orders', icon: RotateCcw, roles: ['buyer'], permission: 'purchase_order.view' },
      { label: 'Delivery Management', path: '/orders/tracking', icon: Truck, roles: ['buyer'], permission: 'delivery.view' }
    ] },
    // Buyer Payments
    { label: 'Payments', icon: CreditCard, roles: ['buyer'], children: [
      { label: 'Invoices', path: '/payments/invoices', icon: FileText, roles: ['buyer'], permission: 'invoice.view' },
      { label: 'Transactions', path: '/payments/transactions', icon: CreditCard, roles: ['buyer'], permission: 'payment.view' },
      { label: 'Escrow (Feature Controlled)', path: '/payments/escrow', icon: Landmark, roles: ['buyer'], permission: 'escrow.view', featureCode: 'escrow-nodal-bank' }
    ] },
    // Buyer Suppliers
    { label: 'Suppliers', icon: Users, roles: ['buyer'], children: [
      { label: 'Supplier Directory', path: '/buyer/vendors', icon: Users, roles: ['buyer'], permission: 'vendor.view' },
      { label: 'Saved Suppliers', path: '/buyer/saved-suppliers', icon: CheckCircle2, roles: ['buyer'], permission: 'vendor.view' },
      { label: 'Messages', path: '/buyer/messages', icon: MessageSquare, roles: ['buyer'], permission: 'vendor.view' }
    ] },
    // Buyer Reports
    { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['buyer'], permission: 'report.view' },
    // Buyer Administration
    { label: 'Administration', icon: Settings, roles: ['buyer'], children: [
      { label: 'Team & Roles', path: '/org/team', icon: UserPlus, roles: ['buyer'], permission: 'team.member.view' },
      { label: 'Delivery Addresses', path: '/buyer/address-book', icon: MapPin, roles: ['buyer'], permission: 'organization.view' },
      { label: 'Settings', path: '/buyer/profile', icon: Settings, roles: ['buyer'], permission: 'organization.view' }
    ] },
    // Buyer Disputes
    { label: 'Disputes', path: '/buyer/disputes', icon: AlertTriangle, roles: ['buyer'], permission: 'dispute.view' },

    // Seller Opportunities
    { label: 'Opportunities', path: '/seller/opportunities', icon: Globe, roles: ['seller', 'shg'], permission: 'marketplace.view' },
    // Seller My Bids
    { label: 'My Bids', path: '/seller/bids', icon: ClipboardList, roles: ['seller', 'shg'], permission: 'bid.submit' },
    // Seller Orders
    { label: 'Orders', icon: Truck, roles: ['seller'], children: [
      { label: 'Purchase Orders', path: '/orders', icon: ShoppingCart, roles: ['seller'], permission: 'purchase_order.view' },
      { label: 'Goods Receipt Note', path: '/grn', icon: ClipboardCheck, roles: ['seller'], permission: 'grn.view' },
      { label: 'Repeat Orders', path: '/orders/repeat', icon: RotateCcw, roles: ['seller'], permission: 'purchase_order.view' },
      { label: 'Delivery Management', path: '/seller/delivery-management', icon: Truck, roles: ['seller'], permission: 'delivery.view' }
    ] },
    // Seller Marketplace
    { label: 'My Catalogue', path: '/seller/catalogue', icon: ShoppingCart, roles: ['seller', 'shg'], permission: 'catalogue.product.view' },
    // Seller Payments
    { label: 'Payments', icon: CreditCard, roles: ['seller'], children: [
      { label: 'Invoices', path: '/payments/invoices', icon: FileText, roles: ['seller'], permission: 'invoice.view' },
      { label: 'Payment Status', path: '/payments/transactions', icon: CreditCard, roles: ['seller'], permission: 'payment.view' }
    ] },
    // Seller Messages
    { label: 'Messages', path: '/seller/messages', icon: MessageSquare, roles: ['seller'], permission: 'marketplace.view' },
    // Seller Reports
    { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['seller'], permission: 'report.view' },
    // Seller Ratings
    { label: 'Ratings', path: '/seller/ratings', icon: CheckCircle2, roles: ['seller'], permission: 'marketplace.view' },
    // Seller Administration
    { label: 'Administration', icon: Settings, roles: ['seller', 'shg'], children: [
      { label: 'Team & Roles', path: '/org/team', icon: UserPlus, roles: ['seller', 'shg'], permission: 'team.member.view' },
      { label: 'Settings', path: '/seller/settings', icon: Settings, roles: ['seller', 'shg'], permission: 'organization.view' }
    ] },
    // Seller Disputes
    { label: 'Disputes', path: '/seller/disputes', icon: AlertTriangle, roles: ['seller'], permission: 'dispute.view' },

    // Common items
    { label: 'Notifications', path: '/settings/notifications', icon: Bell, roles: ['buyer', 'seller', 'admin', 'shg'], permission: 'dashboard.view' },
    { label: 'Help', path: '/help', icon: BookOpen, roles: ['buyer', 'seller', 'admin', 'shg'], permission: 'dashboard.view' },
    { label: 'Disputes', path: '/admin/disputes', icon: AlertTriangle, roles: ['admin'], permission: 'dispute.view' },
    { label: 'Onboarding Hub', path: isShgAccount ? '/shg/onboarding' : (user ? getSellerPortalPath(user) : '/seller/onboarding'), icon: Store, roles: ['seller', 'shg'] },
    { label: 'Onboarding Hub', path: '/buyer/onboarding', icon: Building2, roles: ['buyer'] },
    // { label: 'User Guide', path: '/user-guide', icon: BookOpen, roles: ['admin'] },
  ], [isShgAccount, user]);

  const isAllowed = useCallback((item: SidebarItem) => {
    if (!user) return false;
    const hasRole = item.roles.includes(user.role)
      || (isShgAccount && (item.roles.includes('shg') || item.roles.includes('seller')));
    if (!hasRole) return false;
    if (item.featureCode && user.role !== 'master_admin' && Array.isArray(user.enabledFeatures) && user.enabledFeatures.length > 0) {
      if (!user.enabledFeatures.includes(item.featureCode)) return false;
    }
    if (item.permission) {
      if (user.role === 'master_admin') return true;
      return checkUserPermission(item.permission);
    }
    return true;
  }, [user, isShgAccount, checkUserPermission]);

  const filteredNav = useMemo(() => {
    const mapItemForShg = (item: SidebarItem): SidebarItem => {
      if (!isShgAccount) return item;
      const newPath = item.path?.startsWith('/seller/') ? item.path.replace(/^\/seller\//, '/shg/') : item.path;
      const newChildren = item.children?.map(mapItemForShg);
      return {
        ...item,
        ...(newPath ? { path: newPath } : {}),
        ...(newChildren ? { children: newChildren } : {})
      };
    };

    return navItems
      .map(item => {
        if (!isAllowed(item)) return null;
        if (!item.children?.length) return mapItemForShg(item);
        const children = item.children.filter(isAllowed);
        if (children.length === 0) return null;
        return mapItemForShg({ ...item, children });
      })
      .filter(Boolean) as SidebarItem[];
  }, [isAllowed, navItems, isShgAccount]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_GROUP_STATE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  const handleToggleGroup = useCallback((label: string, defaultOpen: boolean) => {
    setOpenGroups(prev => ({
      ...prev,
      [label]: !(prev[label] ?? defaultOpen)
    }));
  }, []);

  useEffect(() => {
    if (!user) return;
    const runPrefetch = () => {
      if (!shouldPrefetchNavigation()) return;
      const routes = new Set<string>([
        pathname || '/dashboard',
        ...HIGH_PRIORITY_PREFETCH_ROUTES.slice(0, 2),
        ...collectPaths(filteredNav).slice(0, 2)
      ]);
      routes.forEach(path => {
        router.prefetch(path);
        preloadRoute(path);
      });
    };
    const idleWindow = window as Window & typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(runPrefetch, { timeout: 4500 })
      : globalThis.setTimeout(runPrefetch, 1600);
    return () => {
      if (idleWindow.cancelIdleCallback && typeof idleId === 'number') {
        idleWindow.cancelIdleCallback(idleId);
      } else {
        globalThis.clearTimeout(idleId as number);
      }
    };
  }, [filteredNav, pathname, router, user]);

  if (!user) return null;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-blue-800/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        ref={sidebarRef}
        aria-label="Main Navigation"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "gov-sidebar-surface text-white flex flex-col shrink-0 h-full fixed left-0 top-0 z-50 transition-[width,transform] duration-300 ease-in-out lg:translate-x-0 border-r border-white/5 shadow-xl shadow-slate-900/10",
          effectivelyCollapsed ? "w-64 lg:w-20" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}>
        <div className={cn("h-14 px-3 border-b border-white/10 flex items-center", effectivelyCollapsed ? "justify-center" : "justify-between")}>
          <div
            className={cn("flex items-center gap-3 min-w-0 select-none", effectivelyCollapsed && "lg:justify-center")}
            title="MSME Portal"
          >
            <div className="w-11 h-11 bg-white rounded-md flex items-center justify-center overflow-hidden shadow-sm border border-white/20 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logoo.png" alt="SMiLE MSME Logo" className="h-full w-full object-contain" />
            </div>
            <div className={cn("flex flex-col leading-tight min-w-0", effectivelyCollapsed && "lg:hidden")}>
              <span className="font-bold tracking-tight text-base truncate text-white">MSME Portal</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#c8a45c] truncate">Govt. of India</span>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-white/70 hover:text-white" aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>

        </div>

        <nav
          ref={navRef}
          onScroll={handleScroll}
          className={cn("sidebar-scroll-dark flex-1 overflow-y-auto", effectivelyCollapsed ? "p-2 space-y-1" : "p-3 space-y-1")}
        >
          {/* <div className={cn("text-white/40 text-[10px] font-bold uppercase tracking-[0.18em] px-3 mb-2", effectivelyCollapsed && "lg:hidden")}>Navigation</div> */}
          {filteredNav.map((item) => {
            const isGroupActive = Boolean(item.children?.some(child => isSidebarRouteActive(child.path, pathname, currentPathWithQuery)));
            return (
              <SidebarNavGroup
                key={item.label}
                item={item}
                pathname={pathname}
                currentPathWithQuery={currentPathWithQuery}
                isCollapsed={effectivelyCollapsed}
                isOpen={!effectivelyCollapsed && Boolean(openGroups[item.label] ?? isGroupActive)}
                onToggle={() => handleToggleGroup(item.label, isGroupActive)}
                onClose={onClose}
                counts={counts}
              />
            );
          })}
        </nav>

        <div className={cn("border-t border-white/10 bg-black/20", effectivelyCollapsed ? "p-2" : "p-3")}>
          <Link
            href={pathname === '/profile' ? '/dashboard' : '/profile'}
            scroll={false}
            onClick={onClose}
            onMouseEnter={() => preloadRoute('/profile')}
            onFocus={() => preloadRoute('/profile')}
            className={cn(
              "flex items-center gap-3 px-2 mb-3 py-1.5 rounded-md hover:bg-white/10 transition-all duration-200",
              effectivelyCollapsed && "lg:justify-center lg:px-0",
              pathname === '/profile' && "bg-white/10 ring-1 ring-[#c8a45c]/40"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-[#c8a45c] flex items-center justify-center text-xs font-bold text-[#07172e] shadow-inner">
              {user.name.charAt(0)}
            </div>
            <div className={cn("flex flex-col min-w-0", effectivelyCollapsed && "lg:hidden")}>
              <span className="text-sm font-bold truncate text-white" title={orgName || user.name}>
                {orgName || user.name}
              </span>
              <span className="text-[10px] text-white/70 uppercase tracking-wide font-bold truncate" title={user.name}>
                {orgName ? `${user.name} • ${accountLabel}` : `${accountLabel} Account`}
              </span>
            </div>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            title="Logout"
            className={cn("w-full bg-transparent border-white/20 text-white hover:bg-white hover:text-[#0b2447] py-2", effectivelyCollapsed && "lg:px-0")}
          >
            <LogOut className={cn("h-4 w-4", !effectivelyCollapsed && "mr-2")} />
            <span className={cn(effectivelyCollapsed && "lg:hidden")}>Logout</span>
          </Button>
        </div>
      </aside>
    </>
  );
}

interface HeaderProps {
  onMenuClick: () => void;
  onSidebarToggle: () => void;
  isSidebarCollapsed: boolean;
}

export function Header({ onMenuClick, onSidebarToggle, isSidebarCollapsed }: HeaderProps) {
  const { user, token: authToken, logout, login } = useAuth();
  const { count: cartCount } = useMarketplaceCart();
  const { orgStatus } = useOrgRole();
  const orgName = useMemo(() => getResolvedOrgName(user, orgStatus), [user, orgStatus]);
  const pathname = usePathname();
  const router = useRouter();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const profileTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [roleAction, setRoleAction] = useState<'buyer' | 'seller' | null>(null);
  const [pendingActivateRole, setPendingActivateRole] = useState<'buyer' | 'seller' | null>(null);
  const [activateConsent1, setActivateConsent1] = useState(false);
  const [activateConsent2, setActivateConsent2] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const handleProfileMouseEnter = () => {
    if (profileTimeoutRef.current) {
      clearTimeout(profileTimeoutRef.current);
      profileTimeoutRef.current = null;
    }
    setIsProfileDropdownOpen(true);
  };

  const handleProfileMouseLeave = () => {
    profileTimeoutRef.current = setTimeout(() => {
      setIsProfileDropdownOpen(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (profileTimeoutRef.current) {
        clearTimeout(profileTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isPrimaryApproved = useMemo(() => {
    if (!user) return false;
    const status = user.onboardingStatus || user.registrationStatus;
    if (status === 'approved' || status === 'approved_for_procurement') return true;
    if (user.role === 'seller') {
      return user.sellerProfile?.verificationStatusEnum === 'VERIFIED';
    } else if (user.role === 'buyer') {
      return user.buyerProfile?.verificationStatusEnum === 'VERIFIED';
    }
    return false;
  }, [user]);

  const isShgAccount = isShgUser(user);
  const displayRole = isShgAccount ? 'SHG' : user?.role || 'user';

  const handleLogout = async () => {
    await logout('/');
    router.replace('/');
  };

  const handleSwitchRole = async (targetRole: 'buyer' | 'seller') => {
    setRoleAction(targetRole);
    try {
      const res = await api.post('/api/auth/switch-role', { role: targetRole }, {
        headers: { Authorization: `Bearer ${authToken || localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const data = await res.json();
        login(data.accessToken || data.token, data.user, data.refreshToken);
        toast.success(`Switched to ${targetRole} view successfully!`);
        router.push(data.redirectUrl || '/dashboard');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message || 'Failed to switch roles');
      }
    } catch {
      toast.error('Network error. Failed to switch roles.');
    } finally {
      setRoleAction(null);
    }
  };

  const handleActivateRole = async (targetRole: 'buyer' | 'seller') => {
    setRoleAction(targetRole);
    try {
      const res = await api.post('/api/auth/activate-dual-role', { roleToActivate: targetRole }, {
        headers: { Authorization: `Bearer ${authToken || localStorage.getItem('token') || ''}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || `Unable to activate ${targetRole} profile`);
        return;
      }
      login(data.accessToken || data.token, data.user, data.refreshToken);
      toast.success(data.createdProfile
        ? `${targetRole === 'seller' ? 'Seller' : 'Buyer'} profile activated. Complete only the missing role-specific details.`
        : `Switched to ${targetRole} view successfully!`);
      router.push(data.redirectUrl || '/dashboard');
    } catch {
      toast.error('Network error. Failed to activate profile.');
    } finally {
      setRoleAction(null);
    }
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!authToken) return;
      try {
        const res = await api.fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          const body = unwrapApiData<any>(data);
          const items = Array.isArray(body) ? body : body?.notifications || body?.records || body?.items || [];
          setNotifications(Array.isArray(items) ? items : []);
        }
      } catch {
        setNotifications([]);
      }
    };
    fetchNotifications();
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;

    const baseUrl = BASE_URL;
    const streamUrl = `${baseUrl}/api/notifications/stream?token=${encodeURIComponent(authToken)}`;

    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let disposed = false;
    let retryCount = 0;

    const scheduleReconnect = () => {
      if (disposed || retryTimeout) return;
      const delay = Math.min(30000, 1000 * (2 ** retryCount));
      retryCount += 1;
      retryTimeout = setTimeout(() => {
        retryTimeout = null;
        connectStream();
      }, delay);
    };

    const connectStream = () => {
      if (disposed || retryCount > 5) return;
      try {
        eventSource?.close();
        eventSource = new EventSource(streamUrl, { withCredentials: true });

        eventSource.addEventListener('connected', () => {
          retryCount = 0;
          console.log('[SSE] Notification stream connected successfully');
        });

        eventSource.addEventListener('notification', (event) => {
          try {
            const newNotif = JSON.parse(event.data);
            setNotifications(prev => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
            window.dispatchEvent(new CustomEvent('notifications:updated'));
            console.log('[SSE] Received new notification:', newNotif);
          } catch (e) {
            console.error('[SSE] Failed to parse notification:', e);
          }
        });

        eventSource.addEventListener('close', () => {
          eventSource?.close();
          eventSource = null;
          scheduleReconnect();
        });

        eventSource.addEventListener('error', (err) => {
          if (disposed) return;
          console.warn('[SSE] EventSource connection error. Reconnecting with backoff...', err);
          eventSource?.close();
          eventSource = null;
          scheduleReconnect();
        });
      } catch (err) {
        console.error('[SSE] Failed to initialize EventSource:', err);
        scheduleReconnect();
      }
    };

    connectStream();

    return () => {
      disposed = true;
      if (eventSource) {
        eventSource.close();
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [authToken]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    if (isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.isRead).length : 0;

  const markNotificationAsRead = async (id: number | string) => {
    if (!authToken) return;
    try {
      await api.post(`/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch {
      // Keep the dropdown usable if the read receipt fails.
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!authToken || unreadCount === 0) return;
    try {
      await api.post('/api/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch {
      // Keep the dropdown usable if the read receipt fails.
    }
  };

  const openNotification = async (item: PortalNotification) => {
    if (!item.isRead) await markNotificationAsRead(item.id);
    router.push(routeForNotification(item, user?.role));
    setIsNotificationsOpen(false);
  };

  return (
    <header className="liquid-glass-header z-40">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            suppressHydrationWarning
            onClick={onMenuClick}
            className="p-2 -ml-2 text-slate-500 hover:text-[#0b2447] lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <button
            suppressHydrationWarning
            onClick={onSidebarToggle}
            className="hidden lg:flex p-2 -ml-2 text-slate-400 hover:text-[#0b2447] hover:bg-slate-50 rounded-lg transition-colors"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          {/* Organization Identity Badge in Header */}
          {orgName ? (
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 shadow-2xs">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#12335f]/10 text-[#12335f]">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">Organization</span>
                <span className="text-xs font-black text-slate-900 truncate max-w-[160px] md:max-w-[240px] lg:max-w-[340px] leading-tight" title={orgName}>
                  {orgName}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative" ref={notificationRef}>
            <button
              suppressHydrationWarning
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={cn(
                "p-2 rounded-lg transition-all relative",
                isNotificationsOpen ? "bg-slate-100 text-[#0b2447]" : "text-slate-500 hover:bg-slate-50 hover:text-[#0b2447]"
              )}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {isNotificationsOpen && (
              <div className="fixed left-3 right-3 top-16 z-50 max-h-[75dvh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#0b2447]">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="bg-white text-[#0b2447] border-slate-200 font-bold text-[10px]">
                        {unreadCount} NEW
                      </Badge>
                    )}
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wide text-slate-500 transition-colors hover:text-[#0b2447]"
                        title="Mark all as read"
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                        All
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {Array.isArray(notifications) && notifications.length > 0 ? (
                    notifications.map((item) => {
                      const Icon = item.type === 'alert' ? AlertTriangle : item.type === 'success' ? CheckCircle2 : Info;
                      const isWarning = item.type === 'alert';
                      const isSuccess = item.type === 'success';

                      return (
                        <button
                          key={item.id}
                          onClick={() => openNotification(item)}
                          className={cn(
                            "w-full p-4 text-left border-b border-slate-100 transition-all hover:bg-slate-50 group",
                            !item.isRead ? "bg-slate-50" : "opacity-75"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white shadow-sm border border-slate-100",
                              isWarning ? "text-red-500" : isSuccess ? "text-emerald-600" : "text-[#0b2447]"
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <p className={cn(
                                   "text-[10px] font-black uppercase tracking-widest",
                                   isWarning ? "text-red-600" : isSuccess ? "text-emerald-700" : "text-[#0b2447]"
                                )}>{item.title}</p>
                                {!item.isRead && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      markNotificationAsRead(item.id);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        markNotificationAsRead(item.id);
                                      }
                                    }}
                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:text-emerald-600"
                                    title="Mark as read"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-800">{item.message}</p>
                              {item.createdAt && (
                                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                  {new Date(item.createdAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center">
                      <Bell className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No notifications yet</p>
                    </div>
                  )}
                </div>
                {Array.isArray(notifications) && notifications.length > 0 && (
                  <button
                    onClick={() => {
                      router.push('/notifications');
                      setIsNotificationsOpen(false);
                    }}
                    className="w-full py-3 bg-slate-50 border-t border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0b2447] transition-colors"
                  >
                    View All Notifications
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="h-8 w-px bg-slate-200 hidden sm:block" />

          <div 
            className="relative" 
            ref={profileDropdownRef}
            onMouseEnter={handleProfileMouseEnter}
            onMouseLeave={handleProfileMouseLeave}
          >
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-50 transition-colors group text-left cursor-pointer border border-transparent hover:border-slate-200/80"
              aria-label="User profile options"
            >
              <div className="h-8 w-8 rounded-full bg-[#12335f] flex items-center justify-center text-white font-black text-xs shadow-sm ring-2 ring-white ring-offset-1 group-hover:ring-offset-2 transition-all">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:flex flex-col text-left min-w-0">
                <span className="text-xs font-extrabold text-slate-900 truncate max-w-[140px] md:max-w-[180px] leading-tight" title={user?.name}>
                  {user?.name}
                </span>
                <span className="text-[9px] font-black text-[#12335f] uppercase tracking-widest opacity-80 flex items-center gap-1 leading-tight">
                  {displayRole}
                  {orgName && (
                    <span className="text-slate-400 font-semibold truncate max-w-[100px] normal-case" title={orgName}>
                      • {orgName}
                    </span>
                  )}
                  <ChevronDown className="h-2.5 w-2.5 shrink-0 transition-transform duration-200" style={{ transform: isProfileDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </span>
              </div>
            </button>

            {isProfileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                {/* Organization & User identity card */}
                <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/80">
                  {orgName ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Building2 className="h-3.5 w-3.5 text-[#12335f] shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Organization</span>
                      </div>
                      <p className="text-xs font-black text-slate-900 leading-snug break-words" title={orgName}>
                        {orgName}
                      </p>
                      <p className="text-[11px] text-slate-600 font-medium truncate pt-0.5">
                        {user?.name} {user?.email ? <span className="text-slate-400">({user.email})</span> : null}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-slate-900 truncate">{user?.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    </div>
                  )}
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide bg-[#12335f] text-white shadow-2xs">
                      {displayRole}
                    </span>
                    {isPrimaryApproved ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" /> Verified Entity
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="h-2.5 w-2.5 text-amber-600" /> Pending Verification
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/40 border-b border-slate-100">
                  Account Options
                </div>
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    router.push('/profile');
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#12335f] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <UserIcon className="h-4 w-4 text-slate-400" />
                  My Profile & Organization Details
                </button>

                {/* DUAL ROLE SWITCHER / ACTIVATION */}
                {(user?.role === 'buyer' || user?.role === 'seller') && (
                  <>
                    <div className="h-px bg-slate-100 my-1" />
                    {(user?.role === 'seller' ? !!user?.buyerProfile : !!user?.sellerProfile) ? (
                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          handleSwitchRole(user.role === 'seller' ? 'buyer' : 'seller');
                        }}
                        disabled={Boolean(roleAction)}
                        className="w-full text-left px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        {user.role === 'seller' ? (
                          <>
                            <Building2 className="h-4 w-4 text-indigo-500" />
                            {roleAction === 'buyer' ? 'Switching to Buyer...' : 'Switch to Buyer View'}
                          </>
                        ) : (
                          <>
                            <Store className="h-4 w-4 text-indigo-500" />
                            {roleAction === 'seller' ? 'Switching to Seller...' : 'Switch to Seller View'}
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          setPendingActivateRole(user?.role === 'seller' ? 'buyer' : 'seller');
                        }}
                        disabled={Boolean(roleAction)}
                        className="w-full text-left px-4 py-2.5 text-xs font-black text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        {user?.role === 'seller' ? (
                          <>
                            <Building2 className="h-4 w-4 text-amber-600" />
                            {roleAction === 'buyer' ? 'Activating Buyer...' : 'Activate Buyer Profile'}
                          </>
                        ) : (
                          <>
                            <Store className="h-4 w-4 text-amber-600" />
                            {roleAction === 'seller' ? 'Activating Seller...' : 'Activate Seller Profile'}
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}

                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-650 hover:bg-red-50 hover:text-red-750 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 text-red-500" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {pendingActivateRole && isMounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => {
                setPendingActivateRole(null);
                setActivateConsent1(false);
                setActivateConsent2(false);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {!isPrimaryApproved ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shadow-inner mb-3">
                  <Clock className="h-7 w-7 text-amber-600 animate-pulse" />
                </div>

                <div className="space-y-1.5 mb-4">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    Admin Approval Pending
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                    Primary Approval Pending
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                    Admin approval is currently pending for your primary <span className="font-bold text-slate-900 capitalize">{user?.role === 'seller' ? 'Seller' : 'Buyer'} organization</span>. You can activate a <span className="font-bold text-slate-900 capitalize">{pendingActivateRole} profile</span> only after the admin approval for your {user?.role || 'primary'} organization is completed.
                  </p>
                </div>

                <div className="w-full bg-amber-50/80 border border-amber-200/70 rounded-xl p-3.5 text-left text-xs text-amber-950 space-y-1.5 mb-5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Application Status: {user?.onboardingStatus ? String(user.onboardingStatus).replace(/_/g, ' ').toUpperCase() : 'PENDING COMPLIANCE REVIEW'}</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Once our admin compliance team reviews and approves your primary organization application, your profile will be unlocked for dual-role activation.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                  <Button
                    onClick={() => {
                      setPendingActivateRole(null);
                      router.push(user?.role === 'seller' ? '/seller/onboarding' : '/buyer/onboarding');
                    }}
                    className="flex-1 bg-[#12335f] hover:bg-[#0b2445] text-white rounded-xl h-11 px-4 font-bold uppercase text-xs tracking-wider transition-all shadow-md shadow-blue-950/15"
                  >
                    Check Onboarding Status
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPendingActivateRole(null)}
                    className="border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl h-11 px-4 font-semibold uppercase text-xs tracking-wider"
                  >
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shadow-inner mb-3">
                  {pendingActivateRole === 'buyer' ? (
                    <Building2 className="h-7 w-7 text-amber-600" />
                  ) : (
                    <Store className="h-7 w-7 text-amber-600" />
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    Profile Activation Agreement
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                    Activate {pendingActivateRole === 'buyer' ? 'Buyer' : 'Seller'} Account?
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                    Before switching to the <span className="font-semibold text-slate-900 uppercase">{pendingActivateRole} portal</span>, you must accept the activation terms and complete the required onboarding verification.
                  </p>
                </div>

                {/* Declaration Checkboxes */}
                <div className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3 mb-5 text-left">
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={activateConsent1}
                      onChange={(e) => setActivateConsent1(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#12335f] focus:ring-blue-500 shrink-0 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700 leading-snug group-hover:text-slate-900 transition-colors">
                      I confirm that I want to activate the <span className="font-bold text-[#12335f] capitalize">{pendingActivateRole}</span> profile for my organization.
                    </span>
                  </label>

                  <div className="h-px bg-slate-200/60" />

                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={activateConsent2}
                      onChange={(e) => setActivateConsent2(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#12335f] focus:ring-blue-500 shrink-0 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700 leading-snug group-hover:text-slate-900 transition-colors">
                      I agree to upload all required verification documents and complete the <span className="font-bold text-[#12335f] capitalize">{pendingActivateRole} onboarding application</span>.
                    </span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                  <Button
                    disabled={!activateConsent1 || !activateConsent2 || Boolean(roleAction)}
                    onClick={() => {
                      const role = pendingActivateRole;
                      setPendingActivateRole(null);
                      setActivateConsent1(false);
                      setActivateConsent2(false);
                      handleActivateRole(role);
                    }}
                    className="flex-1 bg-[#12335f] hover:bg-[#0b2445] text-white rounded-xl h-11 px-5 font-bold uppercase text-xs tracking-wider transition-all shadow-md shadow-blue-950/15 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Agree & Proceed to Onboarding</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPendingActivateRole(null);
                      setActivateConsent1(false);
                      setActivateConsent2(false);
                    }}
                    className="border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl h-11 px-4 font-semibold uppercase text-xs tracking-wider transition-all"
                  >
                    Do Not Agree
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}

const Badge = ({ children, className, variant }: any) => (
  <span className={cn(
    "px-2 py-0.5 rounded text-[10px] font-bold",
    variant === 'secondary' ? "bg-slate-100 text-slate-600" : "bg-[#0b2447]/10 text-[#0b2447]",
    className
  )}>
    {children}
  </span>
);
