import { searchSocialAccounts } from '@/lib/services/social/search';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    console.log('API: Received search query:', query);

    const results = await searchSocialAccounts(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in search-social API:', error);
    return NextResponse.json({ error: 'Failed to search social accounts' }, { status: 500 });
  }
}
