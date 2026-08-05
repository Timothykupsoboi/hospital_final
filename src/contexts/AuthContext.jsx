// =============================================================
// FILE: AuthContext.jsx
// PURPOSE: Provides global authentication state using Supabase Auth.
//          Wraps the entire app so every component can access:
//            - user       → current Supabase auth user
//            - userType   → 'a' | 'd' | 'r' | 'l' | 'ph'
//            - profile    → the staff row from the relevant table
//            - signOut()  → logs user out and redirects to /login
// =============================================================

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// Role normalizer — single source of truth
const ROLE_MAP = {
  a: 'a', admin: 'a', Admin: 'a', administrator: 'a', superadmin: 'a',
  d: 'd', doctor: 'd', Doctor: 'd',
  r: 'r', receptionist: 'r', Receptionist: 'r', registrar: 'r',
  l: 'l', lab: 'l', Lab: 'l', laboratory: 'l',
  ph: 'ph', pharmacy: 'ph', Pharmacy: 'ph', pharmacist: 'ph',
};

// Role → legacy staff table mapping (admin has no legacy table)
const ROLE_TABLE_MAP = {
  d:  { table: 'doctor',          emailField: 'docemail' },
  r:  { table: 'registrar',       emailField: 'regemail' },
  l:  { table: 'lab_technician',  emailField: 'labemail' },
  ph: { table: 'pharmacist',      emailField: 'phemail'  },
};

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null);
  const [userType, setUserType] = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);

  // Track which user IDs are currently being fetched to prevent duplicate
  // concurrent requests (not the same as the dedup guard — this is per-instance).
  const fetchingRef = useRef(new Set());

  // ----------------------------------------------------------
  // fetchProfile: given a Supabase user, load the matching
  //               profile row and optional legacy staff record.
  //
  // RULES:
  //   - Always resolves (never rejects) so callers don't need try/catch
  //   - Deduplication prevents concurrent fetches for the same user
  //   - hint from Login.jsx sessionStorage skips the profiles DB query
  // ----------------------------------------------------------
  const fetchProfile = async (authUser, hint = null) => {
    if (!authUser) {
      setProfile(null);
      setUserType(null);
      return;
    }

    // Prevent concurrent fetches for the same user ID
    if (fetchingRef.current.has(authUser.id)) {
      console.log('[AuthContext] fetchProfile: dedup skip for', authUser.id);
      return;
    }
    fetchingRef.current.add(authUser.id);

    const t0 = performance.now();
    const isAdminEmail = authUser.email?.toLowerCase().includes('admin');

    try {
      // ── Resolve base profile ──────────────────────────────────────────────
      let profileData = hint || null;

      if (!profileData) {
        // Read profileHint stored by Login.jsx before navigate()
        try {
          const raw = sessionStorage.getItem(`profileHint_${authUser.id}`);
          if (raw) {
            profileData = JSON.parse(raw);
            sessionStorage.removeItem(`profileHint_${authUser.id}`);
          }
        } catch (_) {}
      }

      if (!profileData) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        if (error) {
          console.warn('[AuthContext] Profile query error:', error.message);
        }
        profileData = data || null;
      }

      // Derive normalized role
      const rawRole =
        profileData?.role ||
        profileData?.usertype ||
        authUser.user_metadata?.usertype ||
        authUser.user_metadata?.role ||
        authUser.app_metadata?.role ||
        (isAdminEmail ? 'a' : null);

      const normalizedRole = ROLE_MAP[rawRole] || rawRole || (isAdminEmail ? 'a' : 'a');
      const legacyMapping = ROLE_TABLE_MAP[normalizedRole];

      // ── Fetch legacy staff record if role has one ─────────────────────────
      let legacyData = null;
      if (legacyMapping) {
        try {
          const orFilter = authUser.email
            ? `user_id.eq.${authUser.id},${legacyMapping.emailField}.eq.${authUser.email}`
            : `user_id.eq.${authUser.id}`;

          const { data: legacyList } = await supabase
            .from(legacyMapping.table)
            .select('*')
            .or(orFilter)
            .limit(1);
          legacyData = legacyList?.[0] ?? null;
        } catch (legacyErr) {
          console.warn('[AuthContext] Legacy table query error:', legacyErr.message);
        }
      }

      // Merge
      const base = profileData ?? {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.email,
      };

      const finalProfile = {
        ...base,
        ...(legacyData || {}),
        role: normalizedRole,
      };

      console.log(`[AuthContext] fetchProfile: ${(performance.now() - t0).toFixed(1)} ms | role="${normalizedRole}"`);

      setUserType(normalizedRole);
      setProfile(finalProfile);
    } catch (err) {
      // Always set a fallback profile so the app doesn't hang
      console.error('[AuthContext] fetchProfile error:', err.message);
      const fallbackRole = authUser.user_metadata?.role || authUser.user_metadata?.usertype || (isAdminEmail ? 'a' : null);
      const normalizedFallback = ROLE_MAP[fallbackRole] || fallbackRole || (isAdminEmail ? 'a' : null);
      setUserType(normalizedFallback);
      setProfile({ id: authUser.id, email: authUser.email, role: normalizedFallback });
    } finally {
      fetchingRef.current.delete(authUser.id);
    }
  };

  // ----------------------------------------------------------
  // On mount: restore session, listen for auth changes
  // ----------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    // 1. Restore existing session on page load / refresh
    //    Wrapped in try/catch so network failures never hang the loading spinner.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        return fetchProfile(session?.user ?? null);
      })
      .catch((err) => {
        console.error('[AuthContext] getSession error:', err?.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // 2. Listen for SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED events.
    //    Note: onAuthStateChange fires for INITIAL_SESSION on page load too —
    //    the dedup Set in fetchProfile prevents a double DB query.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        fetchingRef.current.clear();
        setProfile(null);
        setUserType(null);
        return;
      }

      fetchProfile(nextUser).catch((err) => {
        console.error('[AuthContext] onAuthStateChange fetchProfile error:', err?.message);
      });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // ----------------------------------------------------------
  // signOut
  // ----------------------------------------------------------
  const signOut = async () => {
    localStorage.removeItem('hms_bypass');
    fetchingRef.current.clear();
    await supabase.auth.signOut();
    setUser(null);
    setUserType(null);
    setProfile(null);
    window.location.href = '/login';
  };

  const refreshProfile = () => {
    if (user) {
      fetchingRef.current.delete(user.id);
      return fetchProfile(user);
    }
    return Promise.resolve();
  };

  return (
    <AuthContext.Provider value={{ user, userType, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
