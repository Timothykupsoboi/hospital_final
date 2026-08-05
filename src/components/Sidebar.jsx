// =============================================================
// FILE: Sidebar.jsx
// PURPOSE: Navigation sidebar shown on every role's dashboard.
//          Now uses useAuth() (Supabase) instead of localStorage
//          for user profile and sign-out.
//          Fetches hospital name/logo from Supabase system_config table.
// =============================================================

import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    Home, Users, Settings, UserCircle, Pill, FlaskConical, FileText,
    CheckCircle, ChevronRight, Globe, Menu, ChevronLeft, UserPlus, ListOrdered,
    Printer, CalendarRange, Stethoscope, LayoutDashboard, Package, Activity,
    DollarSign, Microscope, Tag, ShoppingCart, Truck, ShoppingBag, LogOut, BarChart3, CreditCard
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const Sidebar = ({ userType }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Get the logged-in user and their profile from AuthContext
    const { profile, signOut, userType: authUserType } = useAuth();

    // Hospital branding fetched from Supabase system_config
    const [hospitalConfig, setHospitalConfig] = React.useState({ name: 'Moonview Medical Center', logo: '' });
    // Persist sidebar state across page loads to avoid "resetting" feel
    const [isCollapsed, setIsCollapsed] = React.useState(() => {
        try {
            const saved = localStorage.getItem('sidebar_collapsed');
            return saved !== null ? JSON.parse(saved) : (window.innerWidth < 1200);
        } catch {
            return window.innerWidth < 1200;
        }
    });
    const [expandedMenu, setExpandedMenu] = React.useState(() => {
        return localStorage.getItem('sidebar_expanded_menu') || null;
    });
    const [showMobile, setShowMobile] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 1024);

    const sidebarRef = React.useRef(null);
    const navRef = React.useRef(null);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    React.useEffect(() => {
        localStorage.setItem('sidebar_collapsed', JSON.stringify(isCollapsed));
    }, [isCollapsed]);

    React.useEffect(() => {
        localStorage.setItem('sidebar_expanded_menu', expandedMenu || '');
    }, [expandedMenu]);

    // Restore scroll position
    React.useEffect(() => {
        if (navRef.current) {
            const savedScroll = localStorage.getItem('sidebar_scroll_pos');
            if (savedScroll) {
                navRef.current.scrollTop = parseInt(savedScroll);
            }
        }
    }, []);

    const handleScroll = (e) => {
        localStorage.setItem('sidebar_scroll_pos', e.target.scrollTop.toString());
    };

    React.useEffect(() => {
        let isMounted = true;
        // Fetch hospital name and logo from system_config table
        supabase
            .from('system_config')
            .select('key, value')
            .in('key', ['hospital_name', 'hospital_logo'])
            .then(({ data, error }) => {
                if (error || !data || !isMounted) return;
                const config = Object.fromEntries(data.map(r => [r.key, r.value]));
                setHospitalConfig({
                    name: config.hospital_name || 'Moonview Medical Center',
                    logo: config.hospital_logo || '',
                });
            })
            .catch(() => {});

        // Close submenus/mobile on click outside
        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                if (isMobile) setShowMobile(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            isMounted = false;
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMobile]);

    // Sign out via Supabase Auth (AuthContext handles redirect)
    const handleLogout = () => signOut();

    // Helper: get the display name from whichever staff table profile we have
    const displayName = profile
        ? (profile.full_name || profile.docname || profile.regname || profile.labname || profile.phname || profile.aname || 'User')
        : 'Loading…';

    const displayEmail = profile
        ? (profile.email || profile.docemail || profile.regemail || profile.labemail || profile.phemail || profile.aemail || '')
        : '';

    // Helper: get photo from profile (whichever field is populated)
    const displayPhoto = profile
        ? (profile.docphoto || profile.regphoto || profile.labphoto || profile.phphoto || null)
        : null;

    // Navigation items per role
    const navItems = {
        r: [
            { name: 'Dashboard',           icon: Home,         path: '/registrar' },
            { name: 'Patient Registration',icon: UserPlus,     path: '/registrar/new-patient' },
            { name: 'Patient Directory',   icon: Users,        path: '/registrar/patients' },
            { name: 'Patient History',     icon: ListOrdered,  path: '/registrar/history' },
            { name: 'Billing Desk',        icon: CreditCard,   path: '/registrar/billing' },
            { name: 'Printing',            icon: Printer,      path: '/registrar/print' },
            { name: 'Reports',             icon: BarChart3,    path: '/registrar/reports' },
            { name: 'Settings',            icon: Settings,     path: '/registrar/settings' },
        ],
        d: [
            { name: 'Dashboard',           icon: Home,         path: '/doctor' },
            { name: 'Appointments / Queue',icon: CalendarRange,path: '/doctor/appointments' },
            { name: 'Patients',            icon: Users,        path: '/doctor/patients' },
            { name: 'Consultation',        icon: Stethoscope,  path: '/doctor/consultation' },
            {
                name: 'Lab Requests',
                icon: FlaskConical,
                path: '/doctor/labs',
                subItems: [
                    { name: 'Pending Labs',    path: '/doctor/labs?status=pending' },
                    { name: 'Ready Results',   path: '/doctor/labs?status=ready' }
                ]
            },
            { name: 'Reports',             icon: BarChart3,    path: '/doctor/reports' },
            { name: 'Settings',            icon: Settings,     path: '/doctor/settings' },
        ],
        a: [
            { name: 'Administration',      type: 'header' },
            { name: 'Dashboard',           icon: LayoutDashboard, path: '/admin' },
            { name: 'Staff Management',    icon: Users,           path: '/admin/staff' },
            { name: 'Financial Logs',      icon: DollarSign,      path: '/admin/financials' },
            { name: 'Reports',             icon: BarChart3,       path: '/admin/reports' },
            { name: 'System Settings',     icon: Settings,        path: '/admin/settings' },

            { name: 'Reception & Registration', type: 'header' },
            { name: 'Admin Home',          icon: Home,            path: '/admin' },
            { name: 'New Registration',    icon: UserPlus,        path: '/admin/register-patient' },
            { name: 'Patient Directory',   icon: Users,           path: '/admin/patients' },
            { name: 'Patient History',     icon: ListOrdered,     path: '/admin/history' },
            { name: 'Billing Desk',        icon: CreditCard,      path: '/admin/billing' },
            { name: 'Printing Hub',        icon: Printer,         path: '/admin/print' },

            { name: 'Clinical Consultation', type: 'header' },
            { name: 'Doctor Home',         icon: Home,            path: '/doctor' },
            { name: 'Clinical Queue',      icon: CalendarRange,   path: '/doctor/appointments' },
            { name: 'Patient Files',       icon: Users,           path: '/doctor/patients' },
            { name: 'Start Consultation',  icon: Stethoscope,     path: '/doctor/consultation' },
            {
                name: 'Clinical Labs',
                icon: FlaskConical,
                path: '/doctor/labs',
                subItems: [
                    { name: 'Pending Labs',    path: '/doctor/labs?status=pending' },
                    { name: 'Ready Results',   path: '/doctor/labs?status=ready' }
                ]
            },

            { name: 'Laboratory Services', type: 'header' },
            { name: 'Lab Home',            icon: Home,            path: '/lab' },
            { name: 'Lab Workbench',       icon: Microscope,      path: '/lab/workbench' },
            { name: 'Results',             icon: CheckCircle,     path: '/lab/results' },
            { name: 'Test Catalog',        icon: Tag,             path: '/lab/catalog' },
            { name: 'Lab Inventory',       icon: Package,         path: '/lab/inventory' },

            { name: 'Pharmacy Operations', type: 'header' },
            { name: 'Pharmacy Home',       icon: Home,            path: '/pharmacy' },
            { name: 'Pharma Workbench',    icon: ShoppingCart,    path: '/pharmacy/workbench' },
            { name: 'Drug Inventory',      icon: Package,         path: '/pharmacy/inventory' },
            { name: 'Drug Status',         icon: Activity,        path: '/pharmacy/status' },
            { name: 'Procurement',         icon: Truck,           path: '/pharmacy/procurement' },
        ],
        l: [
            { name: 'Dashboard',           icon: Home,         path: '/lab' },
            { name: 'Lab Workbench',       icon: Microscope,   path: '/lab/workbench' },
            { name: 'Results',             icon: CheckCircle,  path: '/lab/results' },
            { name: 'Test Catalog',        icon: Tag,          path: '/lab/catalog' },
            { name: 'Inventory',           icon: Package,      path: '/lab/inventory' },
            { name: 'Reports',             icon: BarChart3,    path: '/lab/analytics' },
            { name: 'Settings',            icon: Settings,     path: '/lab/settings' },
        ],
        ph: [
            { name: 'Dashboard',           icon: Home,         path: '/pharmacy' },
            { name: 'Workbench',           icon: ShoppingCart, path: '/pharmacy/workbench' },
            { name: 'Inventory',           icon: Package,      path: '/pharmacy/inventory' },
            { name: 'Medicine Status',     icon: Activity,     path: '/pharmacy/status' },
            { name: 'Procurement',         icon: Truck,        path: '/pharmacy/procurement' },
            { name: 'Reports',             icon: BarChart3,    path: '/pharmacy/reports' },
            { name: 'Settings',            icon: Settings,     path: '/pharmacy/settings' },
        ]
    };

    // If logged in user is admin, show admin items; otherwise show role items or path items
    const loggedInRole = profile?.role || authUserType;
    const isAdmin = loggedInRole === 'a' || loggedInRole === 'Admin' || loggedInRole === 'administrator' || loggedInRole === 'superadmin';
    const activeRoleType = navItems[userType] ? userType : (navItems[loggedInRole] ? loggedInRole : 'a');
    const effectiveUserType = isAdmin ? 'a' : activeRoleType;
    const items = navItems[effectiveUserType] || navItems.a || [];

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);
    const toggleMobile = () => setShowMobile(!showMobile);

    const effectiveCollapsed = isMobile ? false : isCollapsed;

    return (
        <>
        {/* Mobile Toggle Button */}
        <button 
            onClick={toggleMobile}
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: '#007bff',
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                zIndex: 1000,
                display: isMobile ? 'flex' : 'none',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
            }}
        >
            <Menu size={24} />
        </button>

        <aside ref={sidebarRef} style={{
            width: effectiveCollapsed ? '80px' : '260px',
            background: '#ffffff',
            borderRight: '1px solid #dee2e6',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            position: isMobile ? 'fixed' : 'sticky',
            top: 0,
            left: 0,
            zIndex: 1100,
            transition: 'width 0.3s ease, transform 0.3s ease',
            boxShadow: isMobile ? '0 0 20px rgba(0,0,0,0.15)' : 'none',
            transform: isMobile ? (showMobile ? 'translateX(0)' : 'translateX(-100%)') : 'none'
        }}>
            {/* Collapse Toggle (Desktop) */}
            <button 
                onClick={toggleSidebar}
                style={{
                    position: 'absolute',
                    right: '-12px',
                    top: '32px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'white',
                    border: '1px solid #dee2e6',
                    display: isMobile ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10
                }}
            >
                {effectiveCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>


            {/* Profile Block */}
            <div style={{ padding: '32px 24px', textAlign: 'center', borderBottom: '1px solid #f8f9fa' }}>
                <div className="floating-logo" style={{
                    width: effectiveCollapsed ? '50px' : '180px', height: effectiveCollapsed ? '50px' : '180px', borderRadius: '20px',
                    background: '#1e293b', margin: '0 auto 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: effectiveCollapsed ? '2px solid #f1f5f9' : '4px solid #f1f5f9', overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s'
                }}>
                    {displayPhoto ? (
                        <img src={displayPhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : hospitalConfig.logo ? (
                        <img src={hospitalConfig.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <img src="/logo.png" alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                </div>

                {!effectiveCollapsed && (
                    <>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', marginBottom: '4px', letterSpacing: '-0.02em' }}>
                            {displayName}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '24px', fontWeight: '500' }}>
                            {displayEmail}
                        </p>
                    </>
                )}

                {/* Logout — calls Supabase signOut via AuthContext */}
                <div style={{ marginTop: '32px' }}>
                    <button
                        id="sidebar-logout-btn"
                        onClick={handleLogout}
                        style={{
                            width: '100%', padding: effectiveCollapsed ? '10px 0' : '12px',
                            background: '#f8fafc', color: '#475569',
                            border: '1px solid #e2e8f0', borderRadius: '12px',
                            fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: effectiveCollapsed ? '0' : '10px',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; }}
                        title={effectiveCollapsed ? "Log out" : ""}
                    >
                        <LogOut size={16} /> {!effectiveCollapsed && "Sign Out Account"}
                    </button>
                </div>
            </div>

            {/* Navigation List */}
            <nav 
                ref={navRef}
                onScroll={handleScroll}
                style={{ padding: '20px 0', flex: 1, overflowY: 'auto' }}
            >
                {items.map((item, idx) => {
                    // 1. Handle Separator/Header
                    if (item.type === 'header') {
                        return !effectiveCollapsed && (
                            <div key={`header-${idx}`} style={{ 
                                padding: '24px 30px 8px', 
                                fontSize: '0.65rem', 
                                fontWeight: '800', 
                                color: '#94a3b8', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.1em' 
                            }}>
                                {item.name}
                            </div>
                        );
                    }

                    // 2. Handle Regular Items
                    const isActive = location.pathname === item.path ||
                        (item.subItems && item.subItems.some(sub => location.pathname + location.search === sub.path));
                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    const isExpanded = expandedMenu === item.name;

                    return (
                        <div key={item.name}>
                            {hasSubItems ? (
                                <div
                                    onClick={() => setExpandedMenu(isExpanded ? null : item.name)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '15px 30px', cursor: 'pointer',
                                        color: isActive ? '#007bff' : '#6c757d',
                                        background: isActive ? '#f8fafc' : 'transparent',
                                        borderRight: isActive ? '4px solid #007bff' : '4px solid transparent',
                                        fontWeight: isActive ? '700' : '500',
                                        fontSize: '0.9rem', transition: '0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <item.icon size={20} style={{ minWidth: '20px' }} />
                                        {!effectiveCollapsed && <span>{item.name}</span>}
                                    </div>
                                    {!effectiveCollapsed && (
                                        <ChevronRight size={16} style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: '0.3s' }} />
                                    )}
                                </div>
                            ) : (
                                <Link
                                    to={item.path}
                                    onClick={() => { if (isMobile) setShowMobile(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '15px',
                                        padding: '15px 30px', cursor: 'pointer', textDecoration: 'none',
                                        color: isActive ? '#007bff' : '#6c757d',
                                        background: isActive ? '#f8fafc' : 'transparent',
                                        borderRight: isActive ? '4px solid #007bff' : '4px solid transparent',
                                        fontWeight: isActive ? '700' : '500',
                                        fontSize: '0.9rem', transition: '0.2s'
                                    }}
                                >
                                    <item.icon size={20} style={{ minWidth: '20px' }} />
                                    {!effectiveCollapsed && <span>{item.name}</span>}
                                </Link>
                            )}

                            {hasSubItems && isExpanded && (
                                <div style={{ background: '#f8fafc', padding: '5px 0' }}>
                                    {item.subItems.map(sub => {
                                        const subActive = location.pathname + location.search === sub.path;
                                        return (
                                            <Link
                                                key={sub.name}
                                                to={sub.path}
                                                style={{
                                                    display: 'flex', alignItems: 'center',
                                                    padding: '12px 30px 12px 65px',
                                                    textDecoration: 'none',
                                                    color: subActive ? '#007bff' : '#64748b',
                                                    fontSize: '0.85rem',
                                                    fontWeight: subActive ? '700' : '500',
                                                    borderRight: subActive ? '4px solid #007bff' : 'none',
                                                    transition: '0.2s'
                                                }}
                                            >
                                                {sub.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <div style={{ padding: '20px', fontSize: '0.75rem', color: '#adb5bd', textAlign: 'center', borderTop: '1px solid #f8f9fa' }}>
                {effectiveCollapsed ? "LX" : "Powered by lumiaxy System"}
            </div>
        </aside>
        
        {/* Mobile Overlay */}
        {showMobile && isMobile && (
            <div 
                onClick={toggleMobile}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 1050
                }}
            />
        )}
        <style>{`
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-8px); }
                100% { transform: translateY(0px); }
            }
            .floating-logo {
                animation: float 4s ease-in-out infinite;
                transition: all 0.3s ease;
            }
            .floating-logo:hover {
                animation-play-state: paused;
                transform: scale(1.03);
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1) !important;
                cursor: pointer;
            }
        `}</style>
        </>
    );
};

export default Sidebar;
