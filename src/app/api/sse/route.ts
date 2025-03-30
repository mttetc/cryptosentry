import { SSEEventType } from '@/actions/monitor/schemas/sse';
import { sseConfig } from '@/lib/config/sse';
import { rateLimit } from '@/actions/messaging/utils/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { monitorEvent } from '@/actions/monitor/lib/core';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Keep track of active connections with their cleanup functions
const CONNECTIONS = new Map<
  string,
  {
    controller: ReadableStreamController<Uint8Array>;
    userId: string;
    timeoutId: NodeJS.Timeout;
    heartbeatId: NodeJS.Timeout;
    lastActivity: number;
  }
>();

// Keep track of connections per user
const USER_CONNECTIONS = new Map<string, Set<string>>();

/**
 * Helper function to format Server-Sent Events (SSE) messages
 */
function encodeSSE(type: SSEEventType, data: any): Uint8Array {
  return new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Cleanup function for connections
 */
function cleanup(connectionId: string) {
  const connection = CONNECTIONS.get(connectionId);
  if (connection) {
    // Clear all timeouts
    clearTimeout(connection.timeoutId);
    clearInterval(connection.heartbeatId);

    // Close the controller
    try {
      connection.controller.close();
    } catch (error) {
      console.error('Error closing controller:', error);
    }

    // Remove from connections map
    CONNECTIONS.delete(connectionId);

    // Remove from user connections
    const userConnections = USER_CONNECTIONS.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        USER_CONNECTIONS.delete(connection.userId);
      }
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get client IP and user agent for rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Apply rate limiting
    const rateLimitResult = await rateLimit(ip, '/api/sse', userAgent);
    if (!rateLimitResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Check authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = session.user.id;

    // Check if user has reached maximum connections
    const userConnections = USER_CONNECTIONS.get(userId) || new Set();
    if (userConnections.size >= sseConfig.maxConnectionsPerUser) {
      return new Response(
        JSON.stringify({
          error: 'Maximum connections reached',
          limit: sseConfig.maxConnectionsPerUser,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate a unique connection ID
    const connectionId = crypto.randomUUID();

    // Create a new ReadableStream with error handling
    const stream = new ReadableStream({
      start(controller) {
        try {
          // Set up connection timeout
          const timeoutId = setTimeout(() => {
            try {
              controller.enqueue(
                encodeSSE('timeout', {
                  timestamp: Date.now(),
                  reason: 'Connection timeout reached',
                })
              );
              cleanup(connectionId);
            } catch (error) {
              console.error('Error during timeout handling:', error);
            }
          }, sseConfig.connectionTimeout);

          // Set up heartbeat interval
          const heartbeatId = setInterval(() => {
            try {
              controller.enqueue(
                encodeSSE('ping', {
                  timestamp: Date.now(),
                  connectionId,
                })
              );

              // Check for inactivity
              const connection = CONNECTIONS.get(connectionId);
              if (connection) {
                const now = Date.now();
                if (now - connection.lastActivity > sseConfig.connectionTimeout) {
                  controller.enqueue(
                    encodeSSE('timeout', {
                      timestamp: now,
                      reason: 'Connection inactive',
                    })
                  );
                  cleanup(connectionId);
                } else {
                  connection.lastActivity = now;
                }
              }
            } catch (error) {
              console.error('Error during heartbeat:', error);
              cleanup(connectionId);
            }
          }, sseConfig.heartbeatInterval);

          // Add this controller to active connections
          CONNECTIONS.set(connectionId, {
            controller,
            userId,
            timeoutId,
            heartbeatId,
            lastActivity: Date.now(),
          });

          // Add to user connections
          userConnections.add(connectionId);
          USER_CONNECTIONS.set(userId, userConnections);

          // Send initial connection message
          controller.enqueue(
            encodeSSE('init', {
              timestamp: Date.now(),
              connectionId,
              status: 'connected',
              userId,
            })
          );

          // Cleanup on close
          request.signal.addEventListener('abort', () => {
            cleanup(connectionId);
          });
        } catch (error) {
          console.error('Stream initialization error:', error);
          try {
            controller.error(new Error('Failed to initialize stream'));
          } catch (e) {
            console.error('Failed to send error to controller:', e);
          }
          cleanup(connectionId);
        }
      },

      cancel() {
        cleanup(connectionId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering in Nginx
      },
    });
  } catch (error) {
    console.error('SSE route error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate the event
    const event = await request.json();

    // Process the event
    const result = await monitorEvent(event);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Broadcast to connected clients for this user
    const userConnections = USER_CONNECTIONS.get(session.user.id);
    if (userConnections) {
      let eventType: SSEEventType;
      let eventData: any;

      // Format the event based on type
      if (event.type === 'price') {
        eventType = 'price_update';
        eventData = {
          timestamp: Date.now(),
          symbol: event.data.symbol,
          price: event.data.price,
        };
      } else if (event.type === 'social') {
        eventType = 'social_update';
        eventData = {
          timestamp: Date.now(),
          platform: event.data.account,
          content: event.data.content,
        };
      } else {
        return new Response(JSON.stringify({ error: 'Invalid event type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Broadcast to all connections for this user
      for (const connectionId of userConnections) {
        const connection = CONNECTIONS.get(connectionId);
        if (connection) {
          try {
            connection.controller.enqueue(encodeSSE(eventType, eventData));
            connection.lastActivity = Date.now();
          } catch (error) {
            console.error(`Error broadcasting to connection ${connectionId}:`, error);
            cleanup(connectionId);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing event:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process event',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
