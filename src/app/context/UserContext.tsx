'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import { UserDocument } from '@/app/types/user';
import { COLLECTIONS, ROLES, UserPermission } from '@/app/lib/constants';

interface UserContextType {
  user: UserDocument | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: UserPermission) => boolean;
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

          if (userDocSnap.exists()) {
            setUser(userDocSnap.data() as UserDocument);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth Listener Error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // YETKİ MOTORU (Helper Functions)
  const hasPermission = (permission: UserPermission): boolean => {
    if (user?.role === ROLES.ADMIN) return true; // Constant kullanımı ✅
    return user?.permissions.includes(permission) || false;
  };

  const isTrainer = () => user?.role === ROLES.TRAINER;
  const isAdmin = () => user?.role === ROLES.ADMIN;

  return (
    <UserContext.Provider value={{ user, loading, isAuthenticated: !!user, hasPermission, isTrainer, isAdmin }}>
      {!loading && children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) throw new Error('useUser must be used within a UserProvider');
  return context;
};