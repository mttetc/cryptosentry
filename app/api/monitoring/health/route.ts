'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Get active alerts count
    const [priceAlerts, socialAlerts] = await Promise.all([
      supabase.from('price_alerts').select('count').eq('active', true).single(),
      supabase.from('social_alerts').select('count').eq('active', true).single(),
    ]);

    // Get system metrics
    const { data: metrics } = await supabase
      .from('system_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate health scores
    const priceHealth = calculateHealthScore(priceAlerts.data?.count || 0);
    const socialHealth = calculateHealthScore(socialAlerts.data?.count || 0);

    const response = {
      success: true,
      health: {
        price: priceHealth,
        social: socialHealth,
        overall: (priceHealth + socialHealth) / 2,
      },
      metrics: metrics || [],
      timestamp: Date.now(),
    };

    return new NextResponse(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error getting system health:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
}

function calculateHealthScore(alertCount: number): number {
  // Each alert reduces health by 10%
  return Math.max(0, 100 - alertCount * 10);
}
