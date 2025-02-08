# Crypto Alert App

A powerful alert system for cryptocurrency trading that monitors prices and social media activity, sending phone call alerts based on custom conditions.

## Features

- Real-time price monitoring across multiple exchanges
- Social media monitoring with keyword tracking
- Phone call alerts with custom messages
- Team collaboration features
- Custom sound alerts
- Complex alert conditions with AND/OR logic
- Quiet hours and weekend settings
- SMS fallback for notifications
- Rate limiting and webhook security
- Comprehensive request logging

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in your credentials
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `TWILIO_ACCOUNT_SID`: Your Twilio account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio auth token
- `TWILIO_PHONE_NUMBER`: Your Twilio phone number
- `TWILIO_STATUS_CALLBACK_URL`: Webhook URL for call status updates
- `TWILIO_WEBHOOK_ORIGIN`: Allowed origin for Twilio webhooks (CORS)
- `SOCIAL_STREAM_ENDPOINT`: WebSocket endpoint for social media streaming
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL for rate limiting
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token for rate limiting

## Security Features

- Authentication middleware protection
- Database Row Level Security (RLS)
- Webhook signature validation
- Rate limiting (10 requests/minute)
- CORS protection
- Request logging and monitoring
- Team-based access control
- Admin-only webhook logs

## Tech Stack

- Next.js 15
- React 19
- Supabase
- Twilio
- TailwindCSS
- shadcn/ui
- WebSocket for real-time monitoring
- Upstash Redis for rate limiting

## Architecture

### Monitoring System
The application uses a dual-monitoring system:

1. Price Monitoring:
   - WebSocket connection to Binance's streaming API
   - Real-time price updates for all trading pairs
   - Automatic reconnection on connection loss
   - Heartbeat mechanism to maintain connection

2. Social Media Monitoring:
   - WebSocket connection to social media streaming service
   - Keyword and account tracking
   - Real-time content analysis
   - Automatic reconnection handling

### Database Schema

```sql
price_alerts
  - user_id
  - symbol
  - target_price
  - target_price_2
  - percentage_change
  - alert_above
  - alert_below
  - condition_type
  - time_window
  - active

social_alerts
  - user_id
  - account
  - keywords
  - keyword_logic
  - active

users
  - id
  - phone
  - active_24h
  - quiet_hours_start
  - quiet_hours_end
  - weekends_enabled
  - prefer_sms
```

## Project Structure

```
app/
  ├── actions/          # Server actions
  │   ├── alerts.ts     # Alert processing logic
  │   ├── monitor.ts    # WebSocket monitoring
  │   ├── exchanges.ts  # Exchange integrations
  │   └── twilio.ts     # Communication handling
  ├── components/       # React components
  │   ├── alert-builder/# Alert configuration UI
  │   └── monitoring/   # Monitoring status components
  ├── hooks/           # Custom hooks
  │   └── use-toast.ts # Toast notifications
  └── lib/             # Utility functions
      └── supabase.ts  # Database client
```

## API Routes

- `/api/webhooks/twilio`: Handles Twilio status callbacks
- `/api/webhooks/prices`: Handles price update webhooks

## Rate Limiting and Safety

- 5-minute cooldown between notifications
- Quiet hours support
- Weekend disable option
- SMS fallback for failed calls
- Automatic reconnection for lost connections
- Error handling and logging

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT 