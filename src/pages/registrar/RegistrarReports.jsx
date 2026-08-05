import React, { useState, useEffect, useCallback } from 'react';
import { 
    Users, DollarSign, Calendar, TrendingUp, 
    UserPlus, FileCheck, Clock, RefreshCw,
    Download, AlertCircle, CheckCircle2, Receipt
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const RegistrarReports = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        registrations: { total: 0, today: 0, month: 0 },
        visits: { total: 0, pending: 0, completed: 0 },
        billing: { totalCollected: 0, pendingInvoices: 0, paidInvoices: 0 },
        recentSales: []
    });

    const fetchRegistrarData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

            // 1. Patient Registrations
            const { data: patients } = await supabase.from('patient').select('created_at');
            const totalPatients = patients?.length || 0;
            const todayPatients = patients?.filter(p => p.created_at?.startsWith(today)).length || 0;
            const monthPatients = patients?.filter(p => p.created_at >= startOfMonth).length || 0;

            // 2. Visit Metrics
            const { data: visits } = await supabase.from('appointment').select('status, appodate');
            const todayVisits = visits?.filter(v => v.appodate === today).length || 0;
            const completedVisits = visits?.filter(v => v.status === 'completed' || v.status === 'discharged').length || 0;

            // 3. Billing Data (Consolidated from pharmacy_sale, sales, and lab_reports)
            const [
                { data: salesList },
                { data: pharmaSales },
                { data: labReports }
            ] = await Promise.all([
                supabase.from('sales').select('*, patient:pid(pname)').order('created_at', { ascending: false }),
                supabase.from('pharmacy_sale').select('total_amount, created_at'),
                supabase.from('lab_reports').select('cost, created_at')
            ]);

            const salesTotal = salesList?.reduce((acc, s) => acc + Number(s.total_amount || 0), 0) || 0;
            const pharmaTotal = pharmaSales?.reduce((acc, s) => acc + Number(s.total_amount || 0), 0) || 0;
            const labTotal = labReports?.reduce((acc, s) => acc + Number(s.cost || 0), 0) || 0;
            
            const totalCollected = salesTotal + pharmaTotal + labTotal;
            const paidInvoices = (salesList?.length || 0) + (pharmaSales?.length || 0);
            const pendingInvoices = 0;

            // 4. Last Month Comparisons
            const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString();
            const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString();
            const lastMonthPatients = patients?.filter(p => p.created_at >= lastMonthStart && p.created_at <= lastMonthEnd).length || 0;
            const lastMonthVisits = visits?.filter(v => v.appodate >= lastMonthStart && v.appodate <= lastMonthEnd).length || 0;

            setData({
                registrations: { total: totalPatients, today: todayPatients, month: monthPatients, lastMonth: lastMonthPatients },
                visits: { total: visits?.length || 0, today: todayVisits, completed: completedVisits, lastMonth: lastMonthVisits },
                billing: { totalCollected, pendingInvoices, paidInvoices },
                recentSales: (salesList || []).slice(0, 10)
            });

        } catch (e) {
            console.error('Registrar Reports Error:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchRegistrarData();
    }, [fetchRegistrarData]);

    if (loading) return <div style={{ padding: 80, textAlign: 'center', color: '#64748b' }}>Preparing registrar reports...</div>;

    return (
        <div style={{ padding: '40px 56px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Receipt size={32} color="#2563eb" /> Front-Desk Operations Report
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '4px' }}>Real-time metrics for patient registrations, visits, and billing collection.</p>
                </div>
                <button onClick={fetchRegistrarData} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: '600' }}>
                    <RefreshCw size={16} /> Refresh
                </button>
            </header>

            {/* KPI Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
                <div style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px' }}><UserPlus size={20} color="#2563eb" /></div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>New Registrations</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: '900' }}>{data.registrations.today}</h2>
                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Today</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '700', marginTop: '8px' }}>{data.registrations.month} total this month</p>
                </div>

                <div style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '12px' }}><Calendar size={20} color="#10b981" /></div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Visit Volume</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: '900' }}>{data.visits.today}</h2>
                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Appointments Today</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: '700', marginTop: '8px' }}>{data.visits.completed} visits completed overall</p>
                </div>

                <div style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '12px' }}><DollarSign size={20} color="#f59e0b" /></div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Revenue Collected</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: '900' }}>KES {data.billing.totalCollected.toLocaleString()}</h2>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '700', marginTop: '8px' }}>{data.billing.paidInvoices} paid invoices tracked</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
                <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Recent Billing Transactions</h3>
                        <Download size={18} color="#64748b" style={{ cursor: 'pointer' }} />
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice / Receipt</th>
                                    <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient</th>
                                    <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                    <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Method</th>
                                    <th style={{ textAlign: 'right', padding: '16px 24px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                                    <th style={{ textAlign: 'center', padding: '16px 24px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recentSales.map((s, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '16px 24px', fontWeight: '700', fontSize: '0.9rem' }}>{s.receipt_no}</td>
                                        <td style={{ padding: '16px 24px', fontSize: '0.9rem', fontWeight: '600' }}>{s.patient?.pname || s.customer_name || 'Walk-in'}</td>
                                        <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: '#64748b' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '700', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>{s.payment_method || 'Cash'}</span>
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>KES {Number(s.total_amount).toLocaleString()}</td>
                                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: s.status === 'Paid' ? '#10b981' : '#f59e0b', fontWeight: '700', fontSize: '0.75rem', background: s.status === 'Paid' ? '#f0fdf4' : '#fffbeb', padding: '4px 10px', borderRadius: '20px' }}>
                                                <CheckCircle2 size={12} /> {s.status || 'Paid'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {data.recentSales.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No recent billing records found.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegistrarReports;
