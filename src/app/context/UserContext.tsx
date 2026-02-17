'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; // onSnapshot mühürlendi
import { auth, db } from '@/app/lib/firebase';
import { UserDocument } from '@/app/types/user';
import { COLLECTIONS, ROLES, UserPermission, PERMISSIONS } from '@/app/lib/constants';

const ROLES_CONFIG: Record<string, { permissions: UserPermission[] }> = {
  [ROLES.ADMIN]: {
    permissions: [
      PERMISSIONS.VIEW_ALL,
      PERMISSIONS.STUDENT_DELETE,
      PERMISSIONS.ROLE_MANAGE,
      PERMISSIONS.ASSIGNMENT_MANAGE,
      PERMISSIONS.MANAGE_USERS
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
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // HEADER FIX: onSnapshot sayesinde Header'daki isim/ünvan anlık güncellenir
        const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
        const unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as UserDocument);
          }
          setLoading(false);
        });
        return () => unsubscribeDoc();
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  /** Yetki Kaynağı Analizi */
  const getPermissionSource = (permission: UserPermission): 'override' | 'role' | 'legacy' | 'none' => {
    if (!user) return 'none';
    if (user.overrides && permission in user.overrides) return 'override';
    
    // BUILD FIX 1: roles.flatMap (Burası sende tamamdı)
    const roleDefaults = user.roles?.flatMap((r: string) => ROLES_CONFIG[r]?.permissions || []) || [];
    
    if (roleDefaults.includes(permission)) return 'role';
    if (user.permissions?.includes(permission)) return 'legacy';
    return 'none';
  };

  /** Yetki Kontrolü */
  const hasPermission = (permission: UserPermission): boolean => {
    if (!user) return false;
    // 1. Override Kontrolü
    if (user.overrides && permission in user.overrides) return !!user.overrides[permission];
    
    // BUILD FIX 2: Burada hala ROLES_CONFIG[user.role] yazıyordu, düzelttik!
    const roleDefaults = user.roles?.flatMap((r: string) => ROLES_CONFIG[r]?.permissions || []) || [];
    
    if (roleDefaults.includes(permission)) return true;
    // 3. Legacy Kontrolü
    return user.permissions?.includes(permission) || false;
  };

  return (
    <UserContext.Provider value={{ 
      user, loading, isAuthenticated: !!user, 
      hasPermission, getPermissionSource,
      // BUILD FIX 3: Burada da === ROLES.ADMIN gibi tekil kontroller vardı, dizi kontrolüne (includes) çevirdik
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