import { supabase } from './supabase-config.js';

export function isAccountLocked(status) {
  return ['suspended', 'locked'].includes(String(status || '').trim().toLowerCase());
}

export async function fetchAccountAccess(userId) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const { data, error } = await supabase.from('users')
    .select('role, account_status').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Account profile could not be verified.');
  const trustedAdmin = authData?.user?.id === userId
    && authData.user.app_metadata?.role === 'admin';
  return trustedAdmin ? { ...data, role: 'admin' } : data;
}

export async function signOutLockedAccount() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
