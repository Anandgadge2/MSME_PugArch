'use client';
import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './hooks/useAuth';
import { cn } from './lib/utils';
import dynamic from 'next/dynamic';

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px] w-full text-indigo-600 font-bold animate-pulse">
    Loading view...
  </div>
);

const Home = dynamic(() => import('./views/Home'), { ssr: false, loading: LoadingSpinner });
const Login = dynamic(() => import('./views/Login'), { ssr: false, loading: LoadingSpinner });
const Register = dynamic(() => import('./views/Register'), { ssr: false, loading: LoadingSpinner });
const Dashboard = dynamic(() => import('./views/Dashboard'), { ssr: false, loading: LoadingSpinner });
const SellerOnboarding = dynamic(() => import('./views/SellerOnboarding'), { ssr: false, loading: LoadingSpinner });
const BuyerOnboarding = dynamic(() => import('./views/BuyerOnboarding'), { ssr: false, loading: LoadingSpinner });
const AdminOnboarding = dynamic(() => import('./views/AdminOnboarding'), { ssr: false, loading: LoadingSpinner });
const AdminOperations = dynamic(() => import('./views/AdminOperations'), { ssr: false, loading: LoadingSpinner });
const SellerRegistrationFlow = dynamic(() => import('./views/SellerRegistrationFlow'), { ssr: false, loading: LoadingSpinner });
const BuyerRegistrationFlow = dynamic(() => import('./views/BuyerRegistrationFlow'), { ssr: false, loading: LoadingSpinner });
const BuyerProfile = dynamic(() => import('./views/BuyerProfile'), { ssr: false, loading: LoadingSpinner });
const Tenders = dynamic(() => import('./views/Tenders'), { ssr: false, loading: LoadingSpinner });
const Vendors = dynamic(() => import('./views/Vendors'), { ssr: false, loading: LoadingSpinner });
const Quotations = dynamic(() => import('./views/Quotations'), { ssr: false, loading: LoadingSpinner });
const PurchaseOrders = dynamic(() => import('./views/PurchaseOrders'), { ssr: false, loading: LoadingSpinner });
const ParcelTracking = dynamic(() => import('./views/ParcelTracking'), { ssr: false, loading: LoadingSpinner });
const SellerTenders = dynamic(() => import('./views/SellerTenders'), { ssr: false, loading: LoadingSpinner });
const CreateQuotation = dynamic(() => import('./views/CreateQuotation'), { ssr: false, loading: LoadingSpinner });
const SellerSettings = dynamic(() => import('./views/SellerSettings'), { ssr: false, loading: LoadingSpinner });
const Profile = dynamic(() => import('./views/Profile'), { ssr: false, loading: LoadingSpinner });

import Sidebar, { Header } from './components/layout/Navbar';

const roleOk = (role?: string, allowed?: string[]) => !allowed || (role && allowed.includes(role));

function Redirect({ to }: { to: string }) {
  const router = useRouter();

  React.useEffect(() => {
    router.replace(to);
  }, [router, to]);

  return null;
}

export default function App() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const visualCollapsed = isSidebarCollapsed && !isSidebarHovered;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => { 
    if (mounted && !loading && !user && !['/','/login','/seller/register','/buyer/register','/admin/register'].includes(pathname)) {
      router.replace('/'); 
    }
  }, [mounted, loading, user, pathname, router]);

  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 text-center font-bold text-indigo-600">
        PugArch MSME Marketplace...
      </div>
    );
  }

  const renderRoute = () => {
    if (loading) return <div className="flex min-h-dvh items-center justify-center px-4 text-center font-bold text-indigo-600">PugArch MSME Marketplace...</div>;
    if (pathname === '/') return user ? <Redirect to="/dashboard"/> : <Home/>;
    if (pathname === '/login') return user ? <Redirect to="/dashboard"/> : <Login/>;
    if (pathname === '/seller/register') return <SellerRegistrationFlow/>;
    if (pathname === '/buyer/register') return <BuyerRegistrationFlow/>;
    if (pathname === '/admin/register') return <Register type="admin"/>;
    if (!user) return null;
    if (pathname === '/dashboard') return <Dashboard/>;
    if (pathname === '/seller/onboarding' && roleOk(user.role,['seller'])) return <SellerOnboarding/>;
    if (pathname === '/seller/tenders' && roleOk(user.role,['seller'])) return <SellerTenders/>;
    if (pathname === '/seller/settings' && roleOk(user.role,['seller'])) return <SellerSettings/>;
    if (/^\/seller\/tenders\/[^/]+\/bid$/.test(pathname) && roleOk(user.role,['seller'])) return <CreateQuotation/>;
    if (pathname === '/buyer/onboarding' && roleOk(user.role,['buyer'])) return <BuyerOnboarding/>;
    if (pathname === '/buyer/profile' && roleOk(user.role,['buyer'])) return <BuyerProfile/>;
    if (pathname === '/buyer/tenders' && roleOk(user.role,['buyer'])) return <Tenders/>;
    if (pathname === '/buyer/vendors' && roleOk(user.role,['buyer'])) return <Vendors/>;
    if (pathname === '/quotations' && roleOk(user.role,['buyer','seller'])) return <Quotations/>;
    if (pathname === '/buyer/orders' && roleOk(user.role,['buyer'])) return <PurchaseOrders/>;
    if (pathname === '/buyer/tracking' && roleOk(user.role,['buyer'])) return <ParcelTracking/>;
    if (pathname === '/profile') return <Profile/>;
    if (pathname === '/admin/onboarding' && roleOk(user.role,['admin'])) return <AdminOnboarding/>;
    if (pathname === '/admin/procurement' && roleOk(user.role,['admin'])) return <AdminOperations section="procurement"/>;
    if (pathname === '/admin/compliance' && roleOk(user.role,['admin'])) return <AdminOperations section="compliance"/>;
    if (pathname === '/admin/reports' && roleOk(user.role,['admin'])) return <AdminOperations section="reports"/>;
    return <Redirect to="/dashboard"/>;
  };

  const fixedAuthRoutes = ['/', '/login', '/seller/register', '/buyer/register', '/admin/register'];
  const showDashboardLayout = user && !fixedAuthRoutes.includes(pathname);

  return (
    <div className="flex min-h-dvh bg-slate-50 font-sans text-slate-900">
      {showDashboardLayout && (
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          isCollapsed={isSidebarCollapsed} 
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)} 
          onHoverChange={setIsSidebarHovered}
        />
      )}
      
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300", 
        showDashboardLayout && (visualCollapsed ? "lg:pl-20" : "lg:pl-64")
      )}>
        {showDashboardLayout && (
          <Header 
            onMenuClick={() => setIsSidebarOpen(true)} 
            onSidebarToggle={() => setIsSidebarCollapsed(prev => !prev)} 
            isSidebarCollapsed={isSidebarCollapsed}
          />
        )}
        
        <main className={cn(
          "flex-1 min-w-0",
          !showDashboardLayout ? "min-h-dvh overflow-y-auto p-0" : "overflow-y-auto p-3 sm:p-4 md:p-5"
        )}>
          {renderRoute()}
        </main>
      </div>
    </div>
  );
}
