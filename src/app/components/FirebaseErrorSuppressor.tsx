'use client';

import { useEffect } from 'react';

export default function FirebaseErrorSuppressor() {
  useEffect(() => {
    const original = console.error.bind(console);
    console.error = (...args: any[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (msg.includes('INTERNAL ASSERTION FAILED')) return;
      original(...args);
    };
    return () => { console.error = original; };
  }, []);
  return null;
}
