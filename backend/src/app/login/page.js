import { createServerClient } from '@/lib/supabase';
import LoginPage from './LoginPage';

export const metadata = {
  title: 'Sign in to Aquwity',
};

export default function Login() {
  return <LoginPage />;
}
