import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import { hasSupabaseEnv } from '../lib/env';

export default async function HomePage() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/sign-in');
  }
}
