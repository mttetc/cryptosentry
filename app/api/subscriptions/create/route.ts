'use server';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { SUBSCRIPTION_TIERS } from '@/actions/messaging/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

const STRIPE_PRODUCTS = {
  BASIC: process.env.STRIPE_BASIC_PRODUCT_ID!,
  PRO: process.env.STRIPE_PRO_PRODUCT_ID!,
} as const;

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tier } = body as { tier: keyof typeof SUBSCRIPTION_TIERS };

    if (!tier || !SUBSCRIPTION_TIERS[tier]) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid subscription tier' }),
        { status: 400 }
      );
    }

    // Get or create customer
    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', session.user.id)
      .single();

    let stripeCustomerId: string;

    if (customer?.stripe_customer_id) {
      stripeCustomerId = customer.stripe_customer_id;
    } else {
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', session.user.id)
        .single();

      const newCustomer = await stripe.customers.create({
        email: userData?.email || session.user.email,
        metadata: {
          user_id: session.user.id,
        },
      });

      await supabase
        .from('stripe_customers')
        .insert({
          user_id: session.user.id,
          stripe_customer_id: newCustomer.id,
        });

      stripeCustomerId = newCustomer.id;
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRODUCTS[tier],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=cancelled`,
      metadata: {
        user_id: session.user.id,
        tier,
      },
    });

    if (!checkoutSession.url) {
      throw new Error('Failed to create checkout session');
    }

    return new NextResponse(
      JSON.stringify({ url: checkoutSession.url }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating subscription:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create subscription',
      }),
      { status: 500 }
    );
  }
} 