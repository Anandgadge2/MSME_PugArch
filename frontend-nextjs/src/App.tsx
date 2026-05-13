'use client';
import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './hooks/useAuth';
import { cn } from './lib/utils';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SellerOnboarding from './pages/SellerOnboarding';
import BuyerOnboarding from './pages/BuyerOnboarding';
import AdminOnboarding from './pages/AdminOnboarding';
import AdminOperations from './pages/AdminOperations';
import SellerRegistrationFlow from './pages/SellerRegistrationFlow';
import BuyerRegistrationFlow from './pages/BuyerRegistrationFlow';
import BuyerProfile from './pages/BuyerProfile';
import Tenders from './pages/Tenders';
import Vendors from './pages/Vendors';
import Quotations from './pages/Quotations';
import PurchaseOrders from './pages/PurchaseOrders';
import ParcelTracking from './pages/ParcelTracking';
import SellerTenders from './pages/SellerTenders';
import CreateQuotation from './pages/CreateQuotation';
import SellerSettings from './pages/SellerSettings';
import Profile from './pages/Profile';
import Sidebar, { Header } from './components/layout/Navbar';

const roleOk = (role?: string, allowed?: string[]) => !allowed || (role && allowed.includes(role));

export default function App() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const visualCollapsed = isSidebarCollapsed && !isSidebarHovered;

  React.useEffect(() => { if (!loading && !user && !['/','/login','/seller/register','/buyer/register','/admin/register'].includes(pathname)) router.replace('/'); }, [loading,user,pathname,router]);

  const renderRoute = () => {
    if (loading) return <div className="flex min-h-dvh items-center justify-center px-4 text-center font-bold text-indigo-600">PugArch MSME Marketplace...</div>;
    if (pathname === '/') return user ? (router.replace('/dashboard'), null) : <Home/>;
    if (pathname === '/login') return user ? (router.replace('/dashboard'), null) : <Login/>;
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
    router.replace('/dashboard'); return null;
  };

  const fixedAuthRoutes = ['/', '/login', '/seller/register', '/buyer/register', '/admin/register'];
  const isFixedAuthRoute = !user && fixedAuthRoutes.includes(pathname);
  return <div className="flex min-h-dvh bg-slate-50 font-sans text-slate-900"><Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)} onHoverChange={setIsSidebarHovered}/><div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", user && (visualCollapsed ? "lg:pl-20" : "lg:pl-64"))}><Header onMenuClick={() => setIsSidebarOpen(true)} onSidebarToggle={() => setIsSidebarCollapsed(prev => !prev)} isSidebarCollapsed={isSidebarCollapsed}/><main className={cn("flex-1 min-w-0",isFixedAuthRoute ? "min-h-dvh overflow-y-auto p-0" : "overflow-y-auto p-3 sm:p-4 md:p-5")}>{renderRoute()}</main></div></div>;
}
