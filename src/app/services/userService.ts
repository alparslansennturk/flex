import { db } from '@/app/lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserPermission, COLLECTIONS } from '@/app/lib/constants';

export const UserService = {
  // Yeni bir yetenek ekle
  addPermission: async (uid: string, permission: UserPermission) => {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      permissions: arrayUnion(permission)
    });
  },

  // Bir yeteneği geri al
  removePermission: async (uid: string, permission: UserPermission) => {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      permissions: arrayRemove(permission)
    });
  },
  
  // Statü güncelleme (Active/Suspended vb.)
  updateStatus: async (uid: string, status: 'active' | 'passive' | 'suspended') => {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, { status });
  }
};