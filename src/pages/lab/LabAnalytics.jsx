import React, { useState, useEffect, useCallback } from 'react';
import { 
    BarChart3, TrendingUp, Activity, CheckCircle, 
    Clock, Microscope, Award, RefreshCw, Layers,
    DollarSign, ArrowUpRight, ArrowDownRight, Search
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const BAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6'];

function SimpleBar({ data, maxValue, color }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.map((item, i) => {
                const pct = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
                return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 140, fontSize: '0.85rem', color: '#475569', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 20, height: 10, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: color || BAR_COLORS[i % BAR_COLORS.length], borderRadius: 20, transition: 'width 0.8s ease' }} />
                        </div>
                        <div style={{ width: 40, textAlign: 'right', fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>{item.count}</div>
                    </div>
                );
            })}
        </div>
    );
}

export default function LabAnalytics() {
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [data, setData] = useState({
        total: 0,
        completed: 0,
        pending: 0,
        avgTAT: '0.0h',
        totalRevenue: 0,
        todayRevenue: 0,
        categories: [],
        topTests: [],
        technicians: [],
        recentTransactions: []
    });

    const fetchLabIntelligence = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // 1. Fetch Datasets
            const { data: requests } = await supabase.from('lab_requests').select('id, status, test_name, created_at, appointment_id, pid, docid');
            const { data: reports } = await supabase.from('lab_reports').select('created_at, request_id, cost');
            const { data: techs } = await supabase.from('lab_technician').select('labid, labname');
            
            // 2. Fetch Patient Names for recent transactions
            const appoids = [...new Set((requests || []).map(r => r.appointment_id).filter(Boolean))];
            let patientMap = {};
            if (appoids.length > 0) {
                const { data: appoData } = await supabase
                    .from('appointment')
                    .select('appoid, patient:pid(pname)')
                    .in('appoid', appoids);
                patientMap = (appoData || []).reduce((acc, a) => {
                    acc[a.appoid] = a.patient?.pname || 'Unknown';
                    return acc;
                }, {});
            }

            // 3. Aggregate Top Metrics
            const total = requests?.length || 0;
            const completed = requests?.filter(r => r.status === 'completed').length || 0;
            const pending = requests?.filter(r => r.status !== 'completed' && r.status !== 'sample_rejected').length || 0;

            let totalRevenue = 0;
            let todayRevenue = 0;
            
            requests?.forEach(r => {
                if (r.is_paid) {
                    const price = Number(r.price || 0);
                    totalRevenue += price;
                    if (r.created_at?.startsWith(today)) {
                        todayRevenue += price;
                    }
                }
            });

            // Calculate Turnaround Time (TAT) in hours
            let totalTAT = 0;
            let tatCount = 0;
            
            reports?.forEach(rep => {
                const req = requests?.find(r => r.id === rep.request_id);
                if (req && req.created_at && rep.created_at) {
                    const start = new Date(req.created_at);
                    const end = new Date(rep.created_at);
                    const diff = (end - start) / (1000 * 60 * 60); // hours
                    if (diff > 0) {
                        totalTAT += diff;
                        tatCount++;
                    }
                }
            });
            const avgTAT = tatCount > 0 ? (totalTAT / tatCount).toFixed(1) : '0.0';

            // 4. Category/Test Distribution
            const testMap = {};
            const catMap = {};
            requests?.forEach(r => {
                const t = r.test_name || 'Other';
                testMap[t] = (testMap[t] || 0) + 1;
                
                const c = r.test_category || 'General';
                catMap[c] = (catMap[c] || 0) + 1;
            });
            const topTests = Object.entries(testMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            const categories = Object.entries(catMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            // 5. Technician Performance
            const techMap = {};
            const techNameMap = (techs || []).reduce((acc, t) => {
                acc[t.labid] = t.labname;
                return acc;
            }, {});

            reports?.forEach(rep => {
                const name = techNameMap[rep.technician_id] || 'Clinical Staff';
                techMap[name] = (techMap[name] || 0) + 1;
            });
            const technicians = Object.entries(techMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // 6. Recent Transactions
            const recentTransactions = (requests || [])
                .filter(r => r.is_paid)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 10)
                .map(r => ({
                    id: r.id,
                    test_name: r.test_name,
                    price: r.price,
                    pname: patientMap[r.appointment_id] || 'Unknown',
                    date: r.created_at,
                    status: r.status
                }));

            setData({
                total,
                completed,
                pending,
                avgTAT: `${avgTAT}h`,
                totalRevenue,
                todayRevenue,
                topTests,
                technicians,
                categories,
                recentTransactions
            });

        } catch (e) {
            console.error('Lab Intelligence Error:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchLabIntelligence(); }, [fetchLabIntelligence]);

    const completionRate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
    const filteredTransactions = data.recentTransactions.filter(t => 
        t.pname.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.test_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', background: '#f8fafc' }}>
            <div style={{ width: '48px', height: '48px', border: '4px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '20px', color: '#64748b', fontWeight: '600' }}>Analyzing laboratory performance...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    return (
        <div style={{ padding: '40px 56px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-0.04em', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Microscope size={40} color="#6366f1" /> Laboratory Intelligence
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: '500', marginTop: '4px' }}>Turnaround times, revenue streams, and diagnostic throughput.</p>
                </div>
                <button onClick={fetchLabIntelligence} style={{ padding: '12px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: '700', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <RefreshCw size={18} /> Refresh Intel
                </button>
            </header>

            {/* KPI Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
                <div style={{ background: 'white', padding: '28px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ background: '#eef2ff', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                        <DollarSign size={24} color="#6366f1" />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}>KES {data.totalRevenue.toLocaleString()}</h2>
                    <p style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Revenue Generated</p>
                    <p style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '700', marginTop: '12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ArrowUpRight size={16} /> KES {data.todayRevenue.toLocaleString()} today
                    </p>
                </div>

                <div style={{ background: 'white', padding: '28px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ background: '#ecfdf5', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                        <CheckCircle size={24} color="#10b981" />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}>{data.completed}</h2>
                    <p style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tests Finalized</p>
                    <p style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '700', marginTop: '12px' }}>{completionRate}% Completion Rate</p>
                </div>

                <div style={{ background: 'white', padding: '28px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ background: '#fffbeb', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                        <Clock size={24} color="#f59e0b" />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}>{data.pending}</h2>
                    <p style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Queue</p>
                    <p style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: '700', marginTop: '12px' }}>Awaiting processing</p>
                </div>

                <div style={{ background: 'white', padding: '28px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ background: '#f5f3ff', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                        <Activity size={24} color="#8b5cf6" />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}>{data.avgTAT}</h2>
                    <p style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Turnaround Time</p>
                    <p style={{ fontSize: '0.85rem', color: '#8b5cf6', fontWeight: '700', marginTop: '12px' }}>Order to Report</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '40px' }}>
                {/* Top Tests */}
                <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', padding: '36px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <TrendingUp size={24} color="#3b82f6" /> Diagnostic Volume by Test
                    </h3>
                    <SimpleBar data={data.topTests} maxValue={Math.max(...data.topTests.map(t => t.count), 1)} />
                </div>

                {/* Tech Performance */}
                <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', padding: '36px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Award size={24} color="#10b981" /> Technician Productivity
                    </h3>
                    <SimpleBar data={data.technicians} maxValue={Math.max(...data.technicians.map(t => t.count), 1)} color="#10b981" />
                </div>
            </div>

            {/* Recent Lab Transactions */}
            <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <DollarSign size={24} color="#6366f1" /> Recent Lab Revenue
                    </h3>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            placeholder="Search transactions..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none' }}
                        />
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f8fafc' }}>
                            <tr>
                                {['Date', 'Patient', 'Investigation', 'Status', 'Revenue'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '16px 32px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map((tx, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }}>
                                    <td style={{ padding: '16px 32px', fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>{new Date(tx.date).toLocaleDateString()}</td>
                                    <td style={{ padding: '16px 32px', fontWeight: '700', color: '#1e293b' }}>{tx.pname}</td>
                                    <td style={{ padding: '16px 32px', fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>{tx.test_name}</td>
                                    <td style={{ padding: '16px 32px' }}>
                                        <span style={{ 
                                            background: tx.status === 'completed' ? '#ecfdf5' : '#fffbeb', 
                                            color: tx.status === 'completed' ? '#059669' : '#d97706',
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.7rem',
                                            fontWeight: '800',
                                            textTransform: 'uppercase'
                                        }}>
                                            {tx.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 32px', fontWeight: '900', color: '#0f172a', fontSize: '1rem' }}>KES {Number(tx.price).toLocaleString()}</td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                                        No recent transactions found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
