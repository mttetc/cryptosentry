# Messaging Providers

This directory contains the implementation of various messaging providers for sending notifications to users.

## Supported Providers

- **Telnyx**: SMS and voice calls
- **Telegram**: Messages and voice chats

## Architecture

The messaging system is designed to be modular and extensible. Each provider is implemented as a separate module with a consistent interface.

### Core Components

- **Direct Messaging**: A high-level API for sending messages that automatically selects the best provider based on user preferences.
- **Provider-specific Implementations**: Each provider has its own implementation for sending messages and handling webhooks.
- **Schemas and Types**: Shared schemas and types for validating and typing the data passed between components.

## Adding a New Provider

To add a new messaging provider:

1. Create a new file in `src/actions/messaging/providers/` for the provider implementation.
2. Add provider-specific schemas to `src/actions/messaging/schemas.ts`.
3. Add provider-specific types to `src/actions/messaging/types.ts`.
4. Update the `direct-messaging.ts` file to support the new provider.
5. Add provider-specific configuration to `src/actions/messaging/providers/[provider]-config.ts`.
6. Add provider-specific utilities to `src/actions/messaging/providers/[provider]-utils.ts`.

## Provider Implementation

Each provider should implement the following functions:

- `sendSMS(options: SMSOptions): Promise<SMSResponse>`
- `makeCall(options: CallOptions): Promise<CallResponse>`
- `verifyWebhookSignature(payload: string, signature: string, timestamp: string): Promise<boolean>`

## Environment Variables

Each provider requires specific environment variables to be set:

### Telnyx

- `TELNYX_API_KEY`: The API key for authenticating with Telnyx.
- `TELNYX_PUBLIC_KEY`: The public key for verifying webhook signatures.
- `TELNYX_VOICE_NUMBER`: The phone number to use for outbound calls.
- `TELNYX_SENDER_ID`: The sender ID to use for SMS messages.
- `TELNYX_MESSAGING_PROFILE_ID`: The messaging profile ID to use for SMS messages.
- `TELNYX_WEBHOOK_URL`: The webhook URL for Telnyx to send events to.

### Telegram

- `TELEGRAM_BOT_TOKEN`: The bot token for authenticating with the Telegram API.
- `TELEGRAM_BOT_USERNAME`: The username of the Telegram bot.
- `TELEGRAM_WEBHOOK_SECRET`: The secret token for verifying webhook signatures.

## User Preferences

User preferences are stored in the `user_notification_settings` table in the database. The following fields are used for messaging providers:

- `phone`: The user's phone number.
- `prefer_sms`: Whether the user prefers SMS over other messaging methods.
- `telegramEnabled`: Whether the user has enabled Telegram notifications.
- `telegramChatId`: The user's Telegram chat ID.
- `whatsappEnabled`: Whether the user has enabled WhatsApp notifications.
- `whatsappPhone`: The user's WhatsApp phone number.

## Webhook Handling

Each provider has its own webhook endpoint for receiving events from the provider's API. The webhook endpoints are:

- Telnyx: `/api/webhooks/telnyx`
- Telegram: `/api/webhooks/telegram`

Each webhook endpoint verifies the signature of the incoming request and processes the event accordingly.
