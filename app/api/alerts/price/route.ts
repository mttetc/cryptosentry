import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { experimental_taintObjectReference } from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Constants
const EXCHANGE_ENDPOINTS = {
  binance: 'https://api.binance.com/api/v3/ticker/price',
  coinbase: 'https://api.coinbase.com/v2/prices',
  kraken: 'https://api.kraken.com/0/public/Ticker',
};

// Types
interface ExchangePrice {
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    // Get symbol from query params
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return new NextResponse(
        JSON.stringify({ error: "Symbol parameter is required" }),
        { status: 400 }
      );
    }

    // Fetch prices from all exchanges
    const prices = await Promise.all([
      getBinancePrice(symbol),
      getCoinbasePrice(symbol),
      getKrakenPrice(symbol),
    ]);

    const validPrices = prices.filter((p): p is ExchangePrice => p !== null);
    if (!validPrices.length) {
      return new NextResponse(
        JSON.stringify({ error: "No valid prices found" }),
        { status: 404 }
      );
    }

    // Return the median price to avoid outliers
    validPrices.sort((a, b) => a.price - b.price);
    const bestPrice = validPrices[Math.floor(validPrices.length / 2)];

    // Prevent sensitive price data from being exposed
    experimental_taintObjectReference(
      'Do not pass raw price data to client',
      bestPrice
    );

    return new NextResponse(
      JSON.stringify({
        success: true,
        price: bestPrice,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching price:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
}

// Fetch price from Binance
async function getBinancePrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await fetch(`${EXCHANGE_ENDPOINTS.binance}?symbol=${symbol}USDT`);
    const data = await response.json();
    if (data.price) {
      return {
        symbol,
        price: parseFloat(data.price),
        timestamp: Date.now(),
        source: 'binance',
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching Binance price:', error);
    return null;
  }
}

// Fetch price from Coinbase
async function getCoinbasePrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await fetch(`${EXCHANGE_ENDPOINTS.coinbase}/${symbol}-USD/spot`);
    const data = await response.json();
    if (data.data?.amount) {
      return {
        symbol,
        price: parseFloat(data.data.amount),
        timestamp: Date.now(),
        source: 'coinbase',
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching Coinbase price:', error);
    return null;
  }
}

// Fetch price from Kraken
async function getKrakenPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const krakenSymbol = symbol === 'BTC' ? 'XBT' : symbol;
    const response = await fetch(`${EXCHANGE_ENDPOINTS.kraken}?pair=${krakenSymbol}USD`);
    const data = await response.json();
    const pair = Object.keys(data.result)[0];
    if (data.result[pair]?.c?.[0]) {
      return {
        symbol,
        price: parseFloat(data.result[pair].c[0]),
        timestamp: Date.now(),
        source: 'kraken',
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching Kraken price:', error);
    return null;
  }
} 