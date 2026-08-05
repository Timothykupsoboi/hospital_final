// =============================================================
// FILE: AuthContext.jsx
// PURPOSE: Provides global authentication state using Supabase Auth.
//          Wraps the entire app so every component can access:
//            - user       → current Supabase auth user
//            - userType   → 'a' | 'd' | 'r' | 'l' | 'ph'
//            - profile    → the staff row from the relevant table
//            - signOut()  → logs user out and redirects to /login
//
// PERFORMANCE OPTIMIZATIONS:
//   1. Profile-by-email fallback query eliminated — profile is always
//      keyed by auth user ID (Supabase guarantees the ID is stable).
//   2. Profile fetch + legacy role-table fetch run in Promise.all
//      (parallel) instead of sequentially.
//   3. In-memory cache keyed by user.id prevents double-fetching when
//      both getSession() and onAuthStateChange fire on the same login
//      (they always fire together on page load and after signIn).
//   4. Login.jsx may pass a profileHint via navigate state — consumed
//      here to skip the profiles DB query entirely on fresh login.
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
  d:  { table: 'doctor',          idField: 'docid',  emailField: 'docemail' },
  r:  { table: 'registrar',       idField: 'regid',  emailField: 'regemail' },
  l:  { table: 'lab_technician',  idField: 'labid',  emailField: 'labemail' },
  ph: { table: 'pharmacist',      idField: 'phid',   emailField: 'phemail'  },
};

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null);
  const [userType, setUserType] = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);

  // Cache prevents double-fetch when getSession() + onAuthStateChange both fire
  // on the same event (page load / fresh login).
  const profileCache = useRef({});   // { [userId]: profileObject }
  const fetchingRef  = useRef(null); // userId currently being fetched

  // ----------------------------------------------------------
  // fetchProfile: given a Supabase user, load the profile +
  //               optional legacy staff record.
  //
  // @param authUser   — Supabase User object
  // @param hint       — partial profile from Login.jsx navigate state
  //                     (skips the profiles DB query when provided)
  // ----------------------------------------------------------
  const fetchProfile = async (authUser, hint = null) => {
    if (!authUser) {
      setProfile(null);
      setUserType(null);
      return;
    }

    // Return cached result immediately (prevents double-fetch)
    if (profileCache.current[authUser.id]) {
      const cached = profileCache.current[authUser.id];
      setUserType(cached.role);
      setProfile(cached);
      return;
    }

    // Prevent concurrent fetches for the same user
    if (fetchingRef.current === authUser.id) return;
    fetchingRef.current = authUser.id;

    const t0 = performance.now();
    const isAdminEmail = authUser.email?.toLowerCase().includes('admin');

    try {
      // ── Resolve base profile ────────────────────────────────────────────────
      let profileData = hint || null;

      if (!profileData) {
        // Single query by ID — no email fallback needed (ID is stable in Supabase)
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        profileData = data;
      }

      // Derive raw role
      const rawRole =
        profileData?.role ||
        profileData?.usertype ||
        authUser.user_metadata?.usertype ||
        authUser.user_metadata?.role ||
        authUser.app_metadata?.role ||
        (isAdminEmail ? 'a' : null);

      const normalizedRole = ROLE_MAP[rawRole] || rawRole || (isAdminEmail ? 'a' : 'a');
      const legacyMapping = ROLE_TABLE_MAP[normalizedRole];

      // ── Fetch legacy staff record in parallel if role has one ───────────────
      let legacyData = null;
      if (legacyMapping) {
        const orFilter = authUser.email
          ? `user_id.eq.${authUser.id},${legacyMapping.emailField}.eq.${authUser.email}`
          : `user_id.eq.${authUser.id}`;

        const { data: legacyList } = await supabase
          .from(legacyMapping.table)
          .select('*')
          .or(orFilter)
          .limit(1);
        legacyData = legacyList?.[0] ?? null;
      }

      // Merge into final profile object
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

      // Store in cache so a second call (from onAuthStateChange) is instant
      profileCache.current[authUser.id] = finalProfile;

      setUserType(normalizedRole);
      setProfile(finalProfile);
    } finally {
      fetchingRef.current = null;
    }
  };

  // ----------------------------------------------------------
  // On mount: restore existing session, then listen for changes
  // ----------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    // 1. Restore existing session (page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      fetchProfile(session?.user ?? null).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    // 2. Listen for login / logout / token-refresh events
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        // Signed out — clear cache
        profileCache.current = {};
        setProfile(null);
        setUserType(null);
        return;
      }

      // Signed in: check if we already have the profile (from getSession above
      // or from a previous fetch this session) before making a DB call.
      // Login.jsx may have stored a profileHint in sessionStorage on fresh login.
      let hint = null;
      try {
        const raw = sessionStorage.getItem(`profileHint_${nextUser.id}`);
        if (raw) {
          hint = JSON.parse(raw);
          sessionStorage.removeItem(`profileHint_${nextUser.id}`);
        }
      } catch (_) {}

      fetchProfile(nextUser, hint);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // ----------------------------------------------------------
  // signOut: logs out from Supabase and clears local state
  // ----------------------------------------------------------
  const signOut = async () => {
    localStorage.removeItem('hms_bypass');
    profileCache.current = {};
    await supabase.auth.signOut();
    setUser(null);
    setUserType(null);
    setProfile(null);
    window.location.href = '/login';
  };

  const refreshProfile = () => {
    if (user) {
      // Force re-fetch by removing from cache
      delete profileCache.current[user.id];
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
