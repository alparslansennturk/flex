'use client';

import { VercelToolbar } from '@vercel/toolbar/next';
import { useUser } from '@/app/context/UserContext';
import { ROLES } from '@/app/lib/constants';

export default function VercelToolbarWrapper() {
  const { user, loading } = useUser();

  const isDev = process.env.NODE_ENV === 'development';
  const isAdmin = !loading && user?.roles?.includes(ROLES.ADMIN);

  if (!isDev && !isAdmin) return null;

  return <VercelToolbar />;
}
