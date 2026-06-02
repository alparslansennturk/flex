'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; 
import { auth, db } from '@/app/lib/firebase';
import { UserDocument } from '@/app/types/user';
import { COLLECTIONS, ROLES, UserPermission, PERMISSIONS } from '@/app/lib/constants';

const ROLES_CONFIG: Record<string, { permissions: UserPermission[] }> = {
  [ROLES.ADMIN]: {
    permissions: [
      PERMISSIONS.VIEW_ALL,
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.ASSIGNMENT_MANAGE,
      PERMISSIONS.CLASS_MANAGE,
      PERMISSIONS.MANAGEMENT_PANEL,
    ]
  },
  [ROLES.TRAINER]: {
    permissions: [PERMISSIONS.VIEW_ALL]
  }
};

interface UserContextType {
  user: UserDocument | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: UserPermission) => boolean;
  getPermissionSource: (permission: UserPermission) => 'override' | 'role' | 'legacy' | 'none';
  isTrainer: () => boolean;
  isAdmin: () => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    let activeUid: string | null = null;
    let logoutTimer: ReturnType<typeof setTimeout> | null = null;

    const doLogout = () => {
      activeUid = null;
      document.cookie = "flex-token=; path=/; max-age=0";
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }
      setUser(null);
      setLoading(false);
    };

    const _t = () => new Date().toISOString().slice(11, 23);

    // onIdTokenChanged: her token yenilenişinde (saatte bir) tetiklenir → cookie daima taze kalır
    const unsubscribeAuth = onIdTokenChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        if (logoutTimer) {
          // SENARYO A: null sonrası USER geldi → timer iptal
          console.log(`[AUTH][${_t()}] SENARYO-A: null sonrası USER döndü, timer iptal. uid=${firebaseUser.uid}`);
          clearTimeout(logoutTimer);
          logoutTimer = null;
        } else {
          console.log(`[AUTH][${_t()}] USER: uid=${firebaseUser.uid} activeUid=${activeUid}`);
        }

        // Cookie 30 gün ömürlü; Firebase SDK saatte bir token'ı yeniler, bu satır da günceller
        firebaseUser.getIdToken().then(token => {
          document.cookie = `flex-token=${token}; path=/; max-age=2592000; SameSite=Lax`;
        });

        // Aynı kullanıcının token refresh'i → yeni listener açma, mevcut çalışmaya devam etsin
        if (activeUid === firebaseUser.uid) return;

        activeUid = firebaseUser.uid;
        const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
        unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser({ ...(docSnap.data() as UserDocument), uid: firebaseUser.uid });
          }
          setLoading(false);
        }, (error) => {
          console.error("Firestore Dinleme Hatası:", error);
          setLoading(false);
        });
      } else {
        // Chrome Guest Mode multi-tab: yeni sekme açılışında Firebase geçici null üretebilir.
        // 3 saniye bekle; auth geri gelirse logout iptal, hâlâ null ise gerçek logout yap.
        console.log(`[AUTH][${_t()}] NULL geldi → 3s timer başladı`);
        if (logoutTimer) clearTimeout(logoutTimer);
        logoutTimer = setTimeout(() => {
          if (!auth.currentUser) {
            // SENARYO B: 3s doldu, hâlâ null → gerçek logout
            console.log(`[AUTH][${_t()}] SENARYO-B: 3s doldu, auth.currentUser=null → doLogout()`);
            doLogout();
          } else {
            console.log(`[AUTH][${_t()}] 3s doldu ama auth.currentUser var → logout iptal`);
          }
        }, 3000);
      }
    });

    return () => {
      unsubscribeAuth();
      if (logoutTimer) clearTimeout(logoutTimer);
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }
    };
  }, []);

  /** 1. YETKİ KAYNAĞI ANALİZİ */
  const getPermissionSource = (permission: UserPermission): 'override' | 'role' | 'legacy' | 'none' => {
    if (!user) return 'none';
    if (user.permissionOverrides && permission in user.permissionOverrides) return 'override';
    
    // BUILD FIX 1: roles.flatMap (Çoğul kullanım)
    const roleDefaults = user.roles?.flatMap((r: string) => ROLES_CONFIG[r]?.permissions || []) || [];
    
    if (roleDefaults.includes(permission)) return 'role';
    if (user.permissions?.includes(permission)) return 'legacy';
    return 'none';
  };

  /** 2. YETKİ KONTROLÜ */
  const hasPermission = (permission: UserPermission): boolean => {
  if (!user) return false;
  const overrides = user.permissionOverrides as Record<string, boolean> | undefined;
  if (overrides && permission in overrides) return !!overrides[permission];
  const roleDefaults = user.roles?.flatMap((r: string) => ROLES_CONFIG[r]?.permissions || []) || [];
  if (roleDefaults.includes(permission)) return true;
  return user.permissions?.includes(permission) || false;
};

  return (
    <UserContext.Provider value={{ 
      user, loading, isAuthenticated: !!user, 
      hasPermission, getPermissionSource,
      // BUILD FIX 3: includes kullanarak dizi içinde kontrol yapıyoruz
      isTrainer: () => user?.roles?.includes(ROLES.TRAINER) || false,
      isAdmin: () => user?.roles?.includes(ROLES.ADMIN) || false 
    }}>
      {!loading && children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};