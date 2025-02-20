import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { config } from "@/actions/messaging/config";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Keep track of active connections
const CONNECTIONS = new Map<string, {
  controller: ReadableStreamController<any>;
  intervals: NodeJS.Timeout[];
}>();

// Constants
const PRICE_INTERVAL = config.sse.interval;
const SOCIAL_INTERVAL = config.sse.interval * 2;

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

    const connectionId = crypto.randomUUID();

    // Create a new ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Add this controller to active connections
          CONNECTIONS.set(connectionId, {
            controller,
            intervals: [],
          });

          // Send initial connection message
          controller.enqueue(encodeSSE("init", { 
            status: "connected", 
            connectionId 
          }));

          // Set up price monitoring
          const priceMonitoring = async () => {
            try {
              const { data: alerts } = await supabase
                .from("price_alerts")
                .select("*")
                .eq("user_id", session.user.id)
                .eq("active", true);

              if (alerts?.length) {
                // Get latest prices for all symbols
                const symbols = [...new Set(alerts.map(a => a.symbol))];
                const pricePromises = symbols.map(async (symbol) => {
                  const { data: price } = await supabase
                    .from("price_monitoring")
                    .select("*")
                    .eq("symbol", symbol)
                    .order("timestamp", { ascending: false })
                    .limit(1)
                    .single();
                  return price;
                });

                const prices = await Promise.all(pricePromises);
                const validPrices = prices.filter(p => p !== null);

                controller.enqueue(
                  encodeSSE("price_update", {
                    alerts,
                    prices: validPrices,
                    timestamp: Date.now(),
                  })
                );
              }
            } catch (error) {
              console.error("Price monitoring error:", error);
              controller.enqueue(
                encodeSSE("error", {
                  type: "price_monitoring",
                  message: "Failed to fetch price updates",
                })
              );
            }
          };

          // Set up social monitoring
          const socialMonitoring = async () => {
            try {
              const { data: alerts } = await supabase
                .from("social_alerts")
                .select("*")
                .eq("user_id", session.user.id)
                .eq("active", true);

              if (alerts?.length) {
                // Get latest social monitoring data
                const platforms = [...new Set(alerts.map(a => a.platform))];
                const monitoringPromises = platforms.map(async (platform) => {
                  const { data: monitoring } = await supabase
                    .from("social_monitoring")
                    .select("*")
                    .eq("platform", platform)
                    .order("last_checked", { ascending: false })
                    .limit(1)
                    .single();
                  return monitoring;
                });

                const monitoringData = await Promise.all(monitoringPromises);
                const validData = monitoringData.filter(d => d !== null);

                controller.enqueue(
                  encodeSSE("social_update", {
                    alerts,
                    monitoring: validData,
                    timestamp: Date.now(),
                  })
                );
              }
            } catch (error) {
              console.error("Social monitoring error:", error);
              controller.enqueue(
                encodeSSE("error", {
                  type: "social_monitoring",
                  message: "Failed to fetch social updates",
                })
              );
            }
          };

          // Initial data fetch
          await Promise.all([priceMonitoring(), socialMonitoring()]);

          // Set up intervals for continuous monitoring
          const connection = CONNECTIONS.get(connectionId);
          if (connection) {
            connection.intervals.push(
              setInterval(priceMonitoring, PRICE_INTERVAL),
              setInterval(socialMonitoring, SOCIAL_INTERVAL)
            );
          }

          // Cleanup on close
          request.signal.addEventListener("abort", () => {
            cleanup(connectionId);
          });

        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encodeSSE("error", {
              type: "stream",
              message: "Stream interrupted",
            })
          );
          cleanup(connectionId);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Server error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}

// Cleanup function for connections
function cleanup(connectionId: string) {
  const connection = CONNECTIONS.get(connectionId);
  if (connection) {
    // Clear all intervals
    connection.intervals.forEach(clearInterval);
    // Close the controller
    connection.controller.close();
    // Remove from connections map
    CONNECTIONS.delete(connectionId);
  }
}

/**
 * Helper function to format Server-Sent Events (SSE) messages
 */
function encodeSSE(event: string, data: any): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
} 