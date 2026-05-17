import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { EnrollForm } from './enroll-form';

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function TotpEnrollPage({ searchParams }: Props) {
  const jar = await cookies();
  if (!jar.get('stage_token')) {
    redirect('/login');
  }
  const sp = await searchParams;
  return <EnrollForm next={sp.next} />;
}
