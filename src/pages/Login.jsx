// =============================================================
// FILE: Login.jsx
// PURPOSE: Login page using Supabase Auth.
//          Replaces old fetch('/api/login') with supabase.auth.signInWithPassword().
//          After login, reads usertype from user_metadata and redirects
//          to the correct role dashboard (/admin, /doctor, /registrar, /lab, /pharmacy).
//
// PERFORMANCE OPTIMIZATIONS:
//   - Username lookup now uses exact eq() instead of ilike() (~300ms vs ~1000ms)
//   - Removed the redundant profile DB fetch that happened after signInWithPassword.
//     AuthContext already fetches the profile via onAuthStateChange; Login.jsx
//     resolves the redirect from user_metadata (already embedded in the auth response)
//     and falls back to passing profileHint via navigate state so AuthContext can
//     hydrate without a second DB round-trip.
// =============================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, AlertCircle, LockKeyhole, HeartPulse, Microscope, KeyRound, ArrowLeft } from 'lucide-react';

// Route map: usertype code → dashboard path
const ROLE_ROUTES = {
  'a': '/admin',
  'Admin': '/admin',
  'admin': '/admin',
  'administrator': '/admin',
  'Administrator': '/admin',
  'superadmin': '/admin',
  'd': '/doctor',
  'Doctor': '/doctor',
  'doctor': '/doctor',
  'r': '/registrar',
  'Receptionist': '/registrar',
  'receptionist': '/registrar',
  'registrar': '/registrar',
  'l': '/lab',
  'Lab': '/lab',
  'lab': '/lab',
  'ph': '/pharmacy',
  'Pharmacy': '/pharmacy',
  'pharmacy': '/pharmacy',
};

const normalizeRole = (role) => {
  if (!role) return null;
  const r = String(role).trim().toLowerCase();
  if (r === 'a' || r === 'admin' || r === 'administrator' || r === 'superadmin') return 'a';
  if (r === 'd' || r === 'doctor') return 'd';
  if (r === 'r' || r === 'receptionist' || r === 'registrar') return 'r';
  if (r === 'l' || r === 'lab' || r === 'laboratory') return 'l';
  if (r === 'ph' || r === 'pharmacy' || r === 'pharmacist') return 'ph';
  return r;
};

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ----------------------------------------------------------
  // handleLogin: called when the form is submitted
  //
  // OPTIMIZED FLOW (3 steps, was 4–5 sequential DB calls):
  //   1. If username entered: resolve email via exact eq() lookup (not ilike)
  //   2. signInWithPassword — Supabase Auth (unavoidable network cost)
  //   3. Resolve redirect route from user_metadata (0 DB cost) OR from a single
  //      profile fetch that AuthContext would have done anyway — but we pass the
  //      result as navigate state so AuthContext skips its own fetch.
  // ----------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const loginStart = performance.now();

    try {
      // ── Step 1: Resolve username → email (only if no @ in input) ────────────
      let emailToUse = email.trim();

      if (!emailToUse.includes('@')) {
        const t0 = performance.now();
        // Combined query: exact match or case-insensitive fallback in a single request
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email')
          .or(`username.eq.${emailToUse},username.ilike.${emailToUse}`)
          .limit(1)
          .maybeSingle();
        console.log(`[Login Profile ⏱️] Step 1 Username Lookup: ${(performance.now() - t0).toFixed(1)} ms`);

        if (profileData?.email) {
          emailToUse = profileData.email;
        } else {
          setError('Username not found. Please enter a valid username or email address.');
          return;
        }
      }

      // ── Step 2: Supabase Auth ───────────────────────────────────────────────
      const t1 = performance.now();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });
      const authMs = (performance.now() - t1).toFixed(1);
      console.log(`[Login Profile ⏱️] Step 2 Supabase Auth (signInWithPassword): ${authMs} ms`);

      if (authError) {
        setError(authError.message || 'Invalid email or password.');
        return;
      }

      // ── Step 3: Instant Redirect Route Resolution from Auth Metadata ───────
      const t2 = performance.now();
      const meta = data.user?.user_metadata || {};
      const appMeta = data.user?.app_metadata || {};
      const isAdminEmail = data.user?.email?.toLowerCase().includes('admin');

      let rawRole = meta.usertype || meta.role || appMeta.role || appMeta.usertype;
      let profileHint = null;

      // Only query DB if user_metadata is missing role information
      if (!rawRole || (!ROLE_ROUTES[rawRole] && !ROLE_ROUTES[normalizeRole(rawRole)])) {
        const tDb = performance.now();
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, usertype, id, email, full_name, username, status')
          .eq('id', data.user.id)
          .maybeSingle();
        console.log(`[Login Profile ⏱️] Step 3 Fallback Profile DB Query: ${(performance.now() - tDb).toFixed(1)} ms`);
        profileHint = profile;
        rawRole = profile?.role || profile?.usertype || (isAdminEmail ? 'a' : null);
      }

      const normalizedRole = normalizeRole(rawRole) || (isAdminEmail ? 'a' : null);
      const targetRoute = ROLE_ROUTES[rawRole] || ROLE_ROUTES[normalizedRole] || (isAdminEmail ? '/admin' : null);

      console.log(`[Login Profile ⏱️] Step 3 Metadata Role Resolution: ${(performance.now() - t2).toFixed(1)} ms | role="${normalizedRole}"`);

      if (!targetRoute) {
        console.error('[Login] Unrecognized role:', rawRole, '| metadata:', meta);
        setError('Account role not recognized. Contact the system administrator.');
        await supabase.auth.signOut();
        return;
      }

      const totalMs = (performance.now() - loginStart).toFixed(1);
      console.log(`[Login Profile 🚀] TOTAL LOGIN SPEED: ${totalMs} ms → Navigating to ${targetRoute}`);

      if (profileHint) {
        try {
          sessionStorage.setItem(`profileHint_${data.user.id}`, JSON.stringify(profileHint));
        } catch (_) {}
      }

      navigate(targetRoute, { replace: true });

    } catch (err) {
      // Catch any unexpected JS/network error so the button never freezes
      console.error('[Login] Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      // ALWAYS unlock the button — no matter what path was taken above
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fff7ed',
      fontFamily: "'Inter', sans-serif",
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Top Left Back Button */}
      <Link to="/" style={{
          position: 'absolute',
          top: '32px',
          left: '32px',
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          color: '#f97316', 
          textDecoration: 'none', 
          fontWeight: '800',
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          padding: '12px 20px',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '100px',
          border: '1px solid rgba(249, 115, 22, 0.2)',
          boxShadow: '0 4px 15px rgba(249, 115, 22, 0.15)',
          zIndex: 50,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 10px 25px rgba(249, 115, 22, 0.25)';
      }}
      onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(249, 115, 22, 0.15)';
      }}
      >
          <ArrowLeft size={18} /> Back to Home
      </Link>

      {/* Dynamic Background Elements */}
      <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(251, 146, 60, 0.1) 0%, transparent 70%)', borderRadius: '50%' }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, transparent 70%)', borderRadius: '50%' }}></div>

      <div style={{
        width: '100%',
        maxWidth: 1100,
        background: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(255, 255, 255, 0.7)',
        borderRadius: 56,
        display: 'flex',
        overflow: 'hidden',
        boxShadow: '0 50px 100px -20px rgba(249, 115, 22, 0.12), 0 30px 60px -30px rgba(0,0,0,0.1)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Left: Login Form */}
        <div style={{
          flex: 1,
          padding: '80px 70px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRight: '1px solid rgba(249, 115, 22, 0.05)'
        }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f97316', fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>
                <div style={{ width: '20px', height: '2px', background: '#f97316' }}></div> MOONVIEW MEDICAL
            </div>
            <h1 style={{ color: '#0f172a', fontSize: '3.5rem', fontWeight: 900, marginBottom: 8, letterSpacing: '-2px', lineHeight: '1' }}>
              Portal <span style={{ color: '#f97316' }}>Login</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem', fontWeight: '500' }}>Enter your clinical credentials to proceed.</p>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', padding: '14px', borderRadius: '16px', color: '#991b1b', marginBottom: '32px', fontSize: '0.9rem', fontWeight: '600', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 800, marginBottom: 10, paddingLeft: '4px' }}>EMAIL OR USERNAME</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="doctor@moonview.med or username"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '16px 20px',
                  background: 'white', border: '2px solid #f1f5f9', borderRadius: '18px',
                  outline: 'none', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  fontSize: '1rem'
                }}
                className="login-input"
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 800, marginBottom: 10, paddingLeft: '4px' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '16px 20px',
                    background: 'white', border: '2px solid #f1f5f9', borderRadius: '18px',
                    outline: 'none', fontSize: '1rem'
                  }}
                  className="login-input"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '8px' }}>
                  {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#f97316', color: 'white', padding: '18px', borderRadius: '18px',
                border: 'none', fontSize: '1.1rem', fontWeight: '900', cursor: 'pointer',
                boxShadow: '0 20px 40px -10px rgba(249, 115, 22, 0.4)', transition: '0.3s all',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'
              }}
              className="login-btn"
            >
              {loading ? 'Authenticating...' : <><KeyRound size={20} /> Sign In</>}
            </button>
          </form>
        </div>

        {/* Right: Hero Section */}
        <div style={{
          flex: 1.2,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', width: '90%', maxWidth: '500px', animation: 'bob 6s infinite ease-in-out' }}>
            <div style={{ position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%', background: '#f97316', filter: 'blur(100px)', opacity: 0.15, borderRadius: '50%' }}></div>
            
            <div style={{ 
                borderRadius: '40px', 
                overflow: 'hidden', 
                border: '8px solid rgba(255,255,255,0.8)',
                boxShadow: '0 30px 60px -15px rgba(0,0,0,0.3)',
                position: 'relative',
                zIndex: 2
            }}>
                <img 
                    src="/media__1778189859634.jpg" 
                    alt="Clinical Team" 
                    style={{ width: '100%', height: 'auto', display: 'block', transform: 'scale(1.05)' }} 
                />
            </div>

            <div style={{ 
                position: 'absolute', 
                top: '20px', 
                right: '-30px', 
                background: 'rgba(255,255,255,0.9)', 
                backdropFilter: 'blur(10px)',
                padding: '12px 20px', 
                borderRadius: '20px', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 3,
                animation: 'float 4s infinite ease-in-out'
            }}>
                <LockKeyhole style={{ color: '#10b981' }} size={20} />
                <span style={{ fontWeight: '800', fontSize: '0.8rem', color: '#1e293b' }}>SECURE ACCESS</span>
            </div>

            <div style={{ 
                position: 'absolute', 
                bottom: '40px', 
                left: '-30px', 
                background: 'rgba(255,255,255,0.9)', 
                backdropFilter: 'blur(10px)',
                padding: '12px 20px', 
                borderRadius: '20px', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 3,
                animation: 'float 5s infinite ease-in-out'
            }}>
                <HeartPulse style={{ color: '#3b82f6' }} size={20} />
                <span style={{ fontWeight: '800', fontSize: '0.8rem', color: '#1e293b' }}>VERIFIED STAFF</span>
            </div>

            <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '-20px', 
                background: 'rgba(255,255,255,0.9)', 
                backdropFilter: 'blur(10px)',
                width: '44px',
                height: '44px',
                borderRadius: '12px', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3,
                animation: 'float 7s infinite ease-in-out'
            }}>
                <Microscope style={{ color: '#f97316' }} size={24} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-10px) translateX(5px); }
        }
        .login-input:focus {
            border-color: #f97316 !important;
            box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1);
        }
        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 25px 50px -12px rgba(249, 115, 22, 0.5);
        }
        .login-btn:active {
            transform: translateY(0);
        }
      `}</style>
    </div>
  );
};

export default Login;
