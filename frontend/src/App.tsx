'use client';
import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './hooks/useAuth';
import { cn } from './lib/utils';
import Home from './views/Home';
import Login from './views/Login';
import Register from './views/Register';
import Dashboard from './views/Dashboard';
import SellerOnboarding from './views/SellerOnboarding';
import BuyerOnboarding from './views/BuyerOnboarding';
import AdminOnboarding from './views/AdminOnboarding';
import AdminOperations from './views/AdminOperations';
import SellerRegistrationFlow from './views/SellerRegistrationFlow';
import BuyerRegistrationFlow from './views/BuyerRegistrationFlow';
import BuyerProfile from './views/BuyerProfile';
import Tenders from './views/Tenders';
import Vendors from './views/Vendors';
import Quotations from './views/Quotations';
import PurchaseOrders from './views/PurchaseOrders';
import ParcelTracking from './views/ParcelTracking';
import SellerTenders from './views/SellerTenders';
import CreateQuotation from './views/CreateQuotation';
import SellerSettings from './views/SellerSettings';
import Profile from './views/Profile';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const visualCollapsed = isSidebarCollapsed && !isSidebarHovered;

  React.useEffect(() => { 
    if (!loading && !user && !['/','/login','/seller/register','/buyer/register','/admin/register'].includes(pathname)) {
      router.replace('/'); 
    }
  }, [loading, user, pathname, router]);

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
