# CryptoSentry Scripts

This directory contains utility scripts for managing the CryptoSentry application.

## Telegram Webhook Scripts

These scripts help manage the Telegram bot webhook for CryptoSentry.

### Setup Webhook

Sets up the Telegram webhook for the bot. This should be run after deploying the application to production.

```bash
./setup-telegram-webhook.js
```

Required environment variables:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `TELEGRAM_WEBHOOK_URL`: The URL where Telegram will send updates
- `TELEGRAM_WEBHOOK_SECRET`: A secret token to verify webhook requests

### Check Webhook Status

Checks the current status of the Telegram webhook.

```bash
./check-telegram-webhook.js
```

Required environment variables:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token

### Delete Webhook

Deletes the current Telegram webhook.

```bash
./delete-telegram-webhook.js
```

Required environment variables:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token

### Process Webhook Updates

Processes incoming Telegram webhook updates. This can be used to test webhook processing locally or as a reference for the server implementation.

```bash
./process-telegram-webhook.js <webhook-data-file>
```

Example:

```bash
./process-telegram-webhook.js sample-webhook-data.json
```

Required environment variables:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

## Sample Webhook Data

The directory includes sample webhook data files for testing:

- `sample-webhook-data.json`: Sample message webhook data
- `sample-callback-webhook-data.json`: Sample callback query webhook data

## Environment Variables

All scripts use the `.env` file in the project root. Make sure to set up the required environment variables before running the scripts.
