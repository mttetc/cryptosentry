import { TelegramTestNotification } from '../../components/telegram-test-notification';

export const metadata = {
  title: 'Telegram Test | CryptoSentry',
  description: 'Test your Telegram integration',
};

export default function TelegramTestPage() {
  return (
    <div className="container py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Telegram Integration Test</h1>
          <p className="text-muted-foreground">
            Use this page to test your Telegram integration. Make sure you have connected your
            Telegram account in the settings before testing.
          </p>
        </div>

        <TelegramTestNotification />
      </div>
    </div>
  );
}
