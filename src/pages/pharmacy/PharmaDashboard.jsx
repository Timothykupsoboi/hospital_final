// =============================================================
// FILE: PharmaDashboard.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, Users, Layout, CloudSun, Pill, Shield, FlaskConical,
    Activity, Clock, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const PharmaDashboard = () => {
    const [stats, setStats] = useState({
        pendingPrescriptions: 1,
        todaySalesCount: 2,
        todayRevenue: 0,
        lowStock: 0,
        pendingLabs: 0
    });

    const { profile } = useAuth();
    const navigate = useNavigate();
    const [prescriptions, setPrescriptions] = useState([]);
    const [expiringStocks, setExpiringStocks] = useState([]);
    const [todayActivity, setTodayActivity] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayStr = today.toISOString();

                // 1. Fetch Stats & Detail Lists
                const threeMonthsFromNow = new Date();
                threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
                
                const [prescRes, salesRes, inventoryRes, labRes, expiringRes, activityRes] = await Promise.all([
                    supabase.from('prescriptions')
                        .select('prescid, created_at, drug_name, pid, docid, patient:pid(pname), doctor:docid(docname)'),
                    supabase.from('pharmacy_sale')
                        .select('total_amount, created_at')
                        .gte('created_at', todayStr),
                    supabase.from('medicine')
                        .select('id, stock_qty'),
                    supabase.from('lab_requests')
                        .select('id')
                        .neq('status', 'completed'),
                    supabase.from('medicine')
                        .select('med_name, stock_qty, expiry_date')
                        .lte('expiry_date', threeMonthsFromNow.toISOString().split('T')[0])
                        .gte('expiry_date', todayStr.split('T')[0])
                        .order('expiry_date', { ascending: true })
                        .limit(5),
                    supabase.from('pharmacy_sale')
                        .select('created_at, pharmacy_sale_item(quantity, medicine:medicine_id(med_name))')
                        .gte('created_at', todayStr)
                        .order('created_at', { ascending: false })
                        .limit(5)
                ]);

                if (prescRes.error) throw prescRes.error;
                if (salesRes.error) throw salesRes.error;
                if (inventoryRes.error) throw inventoryRes.error;

                const pendingPresc = prescRes.data || [];
                const todaySales = salesRes.data || [];
                const inv = inventoryRes.data || [];
                const pendingLabs = labRes.data || [];
                const activitySales = activityRes.data || [];
                
                const activityData = [];
                activitySales.forEach(sale => {
                    (sale.pharmacy_sale_item || []).forEach(item => {
                        activityData.push({
                            quantity: item.quantity,
                            medicine: item.medicine,
                            sale: { created_at: sale.created_at }
                        });
                    });
                });

                // Sort activity data locally
                const sortedActivity = activityData.sort((a, b) => 
                    new Date(b.sale?.created_at) - new Date(a.sale?.created_at)
                ).slice(0, 5);

                // Calculate stats
                const totalRevenue = todaySales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
                const lowStockCount = inv.filter(item => (item.stock_qty || 0) <= (item.reorder_level || 10)).length;

                setStats({
                    pendingPrescriptions: pendingPresc.length,
                    todaySalesCount: todaySales.length,
                    todayRevenue: totalRevenue,
                    lowStock: lowStockCount,
                    pendingLabs: pendingLabs.length
                });

                // Set detail lists
                setPrescriptions(pendingPresc.map(p => ({
                    ...p,
                    id: p.prescid,
                    pname: p.patient?.pname || 'Patient',
                    docname: p.doctor?.docname || 'Doctor'
                })));

                setExpiringStocks(expiringRes.data || []);
                setTodayActivity(sortedActivity);

            } catch (err) {
                console.error("Dashboard data fetch error:", err);
            }
        };

        fetchDashboardData();
    }, []);

    const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Nice afternoon';
        return 'Good evening';
    };

    const formattedTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const timeParts = formattedTime.split(' ');

    const statCards = [
        { label: 'Pending RX', value: stats.pendingPrescriptions, icon: Pill },
        { label: 'Today Sales', value: stats.todaySalesCount, icon: Users },
        { label: 'Low Stock', value: stats.lowStock, icon: Shield },
        { label: 'Pending Lab', value: stats.pendingLabs, icon: FlaskConical },
    ];

    return (
        <div style={{ padding: '32px 48px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
                {/* Modern Dynamic Welcome Hero */}
                <div style={{
                    backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url('/img/b8.jpg')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '24px',
                    padding: '40px',
                    marginBottom: '40px',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '12px' }}>
                            {getGreeting()},<br />
                            <span style={{ color: '#60a5fa' }}>{profile?.phname || 'Pharmacist Executive'}</span>
                        </h2>
                        <p style={{ fontSize: '1.1rem', opacity: 1, fontWeight: '600', marginBottom: '32px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                            Monitoring <span style={{ color: '#60a5fa', fontWeight: '800' }}>{stats.pendingPrescriptions}</span> pending prescriptions and <span style={{ color: '#f87171', fontWeight: '800' }}>{stats.lowStock}</span> low-stock items today. 💊
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => navigate('/pharmacy/workbench')} style={{ padding: '12px 24px', background: '#3b82f6', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
                                <Layout size={18} /> Open Workbench
                            </button>
                            <button onClick={() => navigate('/pharmacy/inventory')} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Pill size={18} /> Inventory Hub
                            </button>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '20px' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '3rem', fontWeight: '800', lineHeight: 1 }}>24°C</div>
                                <div style={{ fontSize: '1rem', opacity: 0.9, fontWeight: '500' }}>Partly Cloudy</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '16px', borderRadius: '50%', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <CloudSun size={48} />
                            </div>
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '600', opacity: 0.9 }}>Pharmacy Dispensary HQ</div>
                    </div>
                </div>

                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#343a40', marginBottom: '25px' }}>Status</h2>

                {/* Edoc Status Row */}
                <div className="responsive-grid grid-4" style={{ marginBottom: '40px' }}>
                    {statCards.map((stat, idx) => (
                        <div key={idx} style={{ background: 'white', padding: '20px 25px', borderRadius: '4px', border: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#007bff' }}>{stat.value}</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#343a40' }}>{stat.label}</div>
                            </div>
                            <div style={{ padding: '12px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', color: '#007bff' }}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Edoc Content Sections */}
                <div className="responsive-grid grid-2" style={{ gap: '30px' }}>

                    {/* Appointments Section - Real RX Requests */}
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#007bff', marginBottom: '10px' }}>Active Prescription Queue</h3>
                        <p style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '20px' }}>Clinical orders pending dispensing. Click to process medications.</p>

                        <div style={{ background: 'white', borderRadius: '4px', border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', height: '350px', overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr', padding: '12px 20px', borderBottom: '2px solid #007bff', fontSize: '0.85rem', fontWeight: '700', color: '#343a40', background: '#f8f9fa' }}>
                                <div>Time</div>
                                <div>Patient Name</div>
                                <div>Doctor</div>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {prescriptions.length > 0 ? prescriptions.map((rx, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr', padding: '12px 20px', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}>
                                        <div style={{ color: '#6c757d' }}>{new Date(rx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        <div style={{ fontWeight: '600' }}>{rx.pname}</div>
                                        <div>Dr. {rx.docname}</div>
                                    </div>
                                )) : (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#adb5bd' }}>
                                        No pending prescriptions found.
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => navigate('/pharmacy/workbench')}
                                style={{ width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '0', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Open Dispensary Workbench
                            </button>
                        </div>
                    </div>

                    {/* Expiring Stocks Section */}
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#dc3545', marginBottom: '10px' }}>Expiring Stocks (Next 3 Months)</h3>
                        <p style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '20px' }}>Medicines nearing their shelf life limit. Please prioritize usage or plan disposal.</p>

                        <div style={{ background: 'white', borderRadius: '4px', border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', height: '350px', overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', padding: '12px 20px', borderBottom: '2px solid #dc3545', fontSize: '0.85rem', fontWeight: '700', color: '#343a40', background: '#fff5f5' }}>
                                <div>Medication Title</div>
                                <div>Batch</div>
                                <div>Expiry Date</div>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {expiringStocks.length > 0 ? expiringStocks.map((item, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', padding: '12px 20px', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}>
                                        <div style={{ fontWeight: '600' }}>{item.med_name}</div>
                                        <div style={{ color: '#6c757d' }}>{item.batch_no}</div>
                                        <div style={{ color: '#dc3545', fontWeight: '700' }}>{item.expiry_date}</div>
                                    </div>
                                )) : (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#adb5bd' }}>
                                        No medicines expiring soon.
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => navigate('/pharmacy/inventory')}
                                style={{ width: '100%', padding: '12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '0', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Manage Inventory
                            </button>
                        </div>
                    </div>

                </div>

                {/* Latest Medicine Activity Today */}
                <div style={{ marginTop: '40px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#28a745', marginBottom: '10px' }}>Daily Medication Activity (Dispensed Today)</h3>
                    <p style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '20px' }}>Real-time log of medications dispensed to patients during the current shift.</p>

                    <div style={{ background: 'white', borderRadius: '4px', border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', padding: '12px 20px', borderBottom: '2px solid #28a745', fontSize: '0.85rem', fontWeight: '700', color: '#343a40', background: '#f8fff9' }}>
                            <div>Medication Name</div>
                            <div>Quantity</div>
                            <div>Status</div>
                            <div>Dispensed Time</div>
                        </div>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {todayActivity.length > 0 ? todayActivity.map((item, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', padding: '12px 20px', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}>
                                    <div style={{ fontWeight: '600' }}>{item.medicine?.med_name || 'Unknown'}</div>
                                    <div>{item.quantity} units</div>
                                    <div><span style={{ padding: '2px 8px', background: '#e1f7e6', color: '#28a745', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>DISPENSED</span></div>
                                    <div style={{ color: '#6c757d' }}>{new Date(item.sale?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            )) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#adb5bd' }}>
                                    No medications dispensed today yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
        </div>
    );
};

export default PharmaDashboard;
