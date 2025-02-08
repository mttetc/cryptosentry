# Crypto Alert App

A powerful alert system for cryptocurrency trading that monitors prices and sends phone call alerts.

## Features

- Real-time price monitoring across multiple exchanges
- Phone call alerts with custom messages
- Social media monitoring
- Team collaboration features
- Custom sound alerts
- Complex alert conditions with AND/OR logic

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

## Tech Stack

- Next.js 15
- React 19
- Supabase
- Twilio
- TailwindCSS
- shadcn/ui

## Development

The project follows a feature-based structure:

```
app/
  ├── actions/        # Server actions
  ├── components/     # React components
  ├── hooks/         # Custom hooks
  └── lib/           # Utility functions
```

## API Routes

- `/api/webhooks/twilio`: Handles Twilio status callbacks
- `/api/webhooks/prices`: Handles price update webhooks

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT 