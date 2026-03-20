'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
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

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
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
        activeUid = null;
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
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