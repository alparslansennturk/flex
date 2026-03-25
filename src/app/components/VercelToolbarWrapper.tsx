'use client';

import { useEffect, useState } from 'react';
import { VercelToolbar } from '@vercel/toolbar/next';
import { useUser } from '@/app/context/UserContext';
import { ROLES } from '@/app/lib/constants';

export default function VercelToolbarWrapper() {
  const { user, loading } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const isAdmin = !loading && user?.roles?.includes(ROLES.ADMIN);

  if (!isAdmin || !mounted) return null;

  return <VercelToolbar />;
}
