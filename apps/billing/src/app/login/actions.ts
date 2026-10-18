'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, signSession } from '@/lib/auth';

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const expectedEmail = process.env.BILLING_EMAIL;
  const expectedPassword = process.env.BILLING_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    return { error: 'Server configuration error' };
  }

  if (email !== expectedEmail || password !== expectedPassword) {
    return { error: 'Invalid credentials' };
  }

  const sessionValue = await signSession(email);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60, // 8 hours in seconds
    path: '/',
  });

  redirect('/');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}
