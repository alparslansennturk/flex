/**
 * KULLANIM: Browser console'da import edip çalıştır, veya
 * herhangi bir component'te geçici olarak çağır:
 *   import { runUserAudit } from '@/app/lib/debugUsers';
 *   runUserAudit();
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

const EXPECTED_FIELDS: Record<string, string> = {
  name:               'string',
  surname:            'string',
  email:              'string',
  roles:              'array',   // Tek otorite: roles array (birden çok rol desteklenir)
  isActivated:        'boolean',
  branch:             'string',
};

function getType(value: unknown): string {
  if (value === null)           return 'null';
  if (value === undefined)      return 'undefined';
  if (Array.isArray(value))     return 'array';
  return typeof value;
}

export async function runUserAudit() {
  console.group('🔍 USER AUDIT BAŞLIYOR');

  const snapshot = await getDocs(collection(db, 'users'));
  const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

  console.log(`Toplam kullanıcı: ${docs.length}`);

  const problems: Array<{ id: string; email: string; issues: string[] }> = [];

  docs.forEach(u => {
    const issues: string[] = [];

    // 1. Beklenen field'lar var mı?
    Object.entries(EXPECTED_FIELDS).forEach(([field, expectedType]) => {
      const val = u[field];
      const actualType = getType(val);

      if (actualType === 'undefined') {
        issues.push(`❌ Eksik field: "${field}"`);
      } else if (actualType !== expectedType) {
        issues.push(`⚠️  "${field}" tipi yanlış: beklenen=${expectedType}, gelen=${actualType} (değer: ${JSON.stringify(val)})`);
      } else if (actualType === 'string' && val.trim() === '') {
        issues.push(`⚠️  "${field}" boş string`);
      }
    });

    // 2. roles array boş mu?
    if (Array.isArray(u.roles)) {
      if (u.roles.length === 0) {
        issues.push(`❌ roles array boş — kullanıcının en az bir rolü olmalı`);
      }
      u.roles.forEach((r: unknown, i: number) => {
        if (typeof r !== 'string') {
          issues.push(`❌ roles[${i}] string değil: ${JSON.stringify(r)}`);
        }
      });
    }

    // 3. role (tekil, eski alan) varsa roles ile tutarlı mı? — opsiyonel kontrol
    if (u.role && Array.isArray(u.roles) && !u.roles.includes(u.role)) {
      issues.push(`⚠️  Eski "role" alanı ("${u.role}") roles array'inde yok: ${JSON.stringify(u.roles)} — güncellenmeli`);
    }

    // 4. null değer var mı?
    Object.entries(u).forEach(([key, val]) => {
      if (val === null) issues.push(`⚠️  "${key}" null`);
    });

    if (issues.length > 0) {
      problems.push({ id: u.id, email: u.email ?? '(email yok)', issues });
    }
  });

  if (problems.length === 0) {
    console.log('✅ Tüm kullanıcı verileri tutarlı, sorun yok.');
  } else {
    console.warn(`\n🚨 ${problems.length} kullanıcıda sorun bulundu:\n`);
    problems.forEach(p => {
      console.group(`👤 ${p.email} (id: ${p.id})`);
      p.issues.forEach(i => console.warn(i));
      console.groupEnd();
    });
  }

  console.groupEnd();
  return problems;
}
