import { getUser } from '@/lib/db/queries';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  
  console.log('🔍 [API /api/user] Cookie present:', !!sessionCookie);
  if (sessionCookie) {
    console.log('🔍 [API /api/user] Cookie length:', sessionCookie.value?.length);
  }
  
  const user = await getUser();
  console.log('🔍 [API /api/user] User found:', !!user, user?.email);
  
  return Response.json(user);
}
