import { createServerSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid');
    const status = formData.get('CallStatus');
    const duration = formData.get('CallDuration');

    const supabase = await createServerSupabaseClient();

    // Update alert history with call status
    const { error } = await supabase
      .from('alert_history')
      .update({
        call_status: status,
        call_duration: duration,
        updated_at: new Date().toISOString(),
      })
      .eq('call_sid', callSid);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Twilio webhook error:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}
