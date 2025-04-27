import { TelegramSetup } from '@/components/messaging/telegram-setup';

export default function SettingsPage() {
  return (
    <div className="container mx-auto space-y-8 py-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="grid gap-8">
        <TelegramSetup />
        {/* Other settings components */}
      </div>
    </div>
  );
}
