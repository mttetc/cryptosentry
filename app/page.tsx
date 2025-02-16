import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <section className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-5xl font-bold mb-6">
            Monitor Social Posts & Get Instant Alerts
          </h1>
          <p className="text-xl mb-8 text-muted-foreground">
            Get notified immediately when specific accounts post about topics you care about. 
            Receive alerts via phone call or SMS.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="px-8">
              Get Started
            </Button>
          </Link>
        </section>

        <section className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="p-6 rounded-lg border">
            <h3 className="text-xl font-semibold mb-3">Monitor Any Account</h3>
            <p className="text-muted-foreground">
              Track posts from any public account without needing special access or tokens.
            </p>
          </div>

          <div className="p-6 rounded-lg border">
            <h3 className="text-xl font-semibold mb-3">Real-time Alerts</h3>
            <p className="text-muted-foreground">
              Get phone calls or SMS messages within seconds of a matching post.
            </p>
          </div>

          <div className="p-6 rounded-lg border">
            <h3 className="text-xl font-semibold mb-3">Custom Keywords</h3>
            <p className="text-muted-foreground">
              Set up your own keywords and phrases to trigger alerts when they appear in posts.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto mt-16 text-center">
          <h2 className="text-3xl font-bold mb-6">
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="text-left">
              <h3 className="text-xl font-semibold mb-3">1. Choose Accounts</h3>
              <p className="text-muted-foreground">
                Select which accounts you want to monitor. Add as many as you need.
              </p>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-semibold mb-3">2. Set Keywords</h3>
              <p className="text-muted-foreground">
                Define the words or phrases that matter to you.
              </p>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-semibold mb-3">3. Choose Alert Method</h3>
              <p className="text-muted-foreground">
                Pick between phone calls or SMS notifications.
              </p>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-semibold mb-3">4. Get Notified</h3>
              <p className="text-muted-foreground">
                Receive immediate alerts when your keywords are mentioned.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
