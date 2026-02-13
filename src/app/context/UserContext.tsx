'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import { UserDocument } from '@/app/types/user';
import { COLLECTIONS, ROLES, UserPermission, PERMISSIONS } from '@/app/lib/constants';

/** * Rol bazlı varsayılan yetki yapılandırması.
 * Eğitmen (Trainer) artık ASSIGNMENT_MANAGE yetkisine sahip değil.
 */
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
    // Eğitmenin varsayılan yetkileri KISITLI kalmalı
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) setUser(userDocSnap.data() as UserDocument);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth Error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  /** Yetkinin nereden geldiğini analiz eder (Hata ayıklama ve UI için) */
  const getPermissionSource = (permission: UserPermission): 'override' | 'role' | 'legacy' | 'none' => {
    if (!user) return 'none';
    if (user.overrides && permission in user.overrides) return 'override';
    const roleDefaults = ROLES_CONFIG[user.role]?.permissions || [];
    if (roleDefaults.includes(permission)) return 'role';
    if (user.permissions?.includes(permission)) return 'legacy';
    return 'none';
  };

  /** Hiyerarşik yetki kontrolü: Önce İstisnalar (Overrides), sonra Rol, en son Statik Liste */
  const hasPermission = (permission: UserPermission): boolean => {
    if (!user) return false;
    // 1. Kullanıcıya özel istisna (Override) kontrolü
    if (user.overrides && permission in user.overrides) return !!user.overrides[permission];
    // 2. Rol bazlı yetki kontrolü
    const roleDefaults = ROLES_CONFIG[user.role]?.permissions || [];
    if (roleDefaults.includes(permission)) return true;
    // 3. Eski (Legacy) yetki dizisi kontrolü
    return user.permissions?.includes(permission) || false;
  };

  return (
    <UserContext.Provider value={{ 
      user, loading, isAuthenticated: !!user, 
      hasPermission, getPermissionSource,
      isTrainer: () => user?.role === ROLES.TRAINER,
      isAdmin: () => user?.role === ROLES.ADMIN 
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