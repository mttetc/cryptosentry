import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { WaitlistForm } from '@/components/waitlist/waitlist-form';
import { ArrowRight, Bell, LineChart, X } from 'lucide-react';
import Link from 'next/link';
import { FEATURES } from '@/config/features';

function WaitlistHero() {
  return (
    <section className="mx-auto mb-16 max-w-4xl text-center">
      <span className="mb-4 inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
        Coming Soon
      </span>
      <h1 className="mb-6 text-5xl font-bold">
        Monitor Crypto Influencers & Get Instant Price Alerts
      </h1>
      <p className="mx-auto mb-12 max-w-2xl text-xl text-muted-foreground">
        Get instant phone calls or SMS when key influencers mention specific tokens or when prices
        hit your targets.
      </p>
      <div className="mx-auto max-w-md">
        <WaitlistForm />
      </div>
    </section>
  );
}

function AppHero() {
  return (
    <section className="mx-auto mb-16 max-w-4xl text-center">
      <h1 className="mb-6 text-5xl font-bold">
        Monitor Crypto Influencers & Get Instant Price Alerts
      </h1>
      <p className="mb-8 text-xl text-muted-foreground">
        Get notified instantly when key crypto influencers post about specific tokens, or when
        prices hit your targets. Receive alerts via phone call or SMS.
      </p>
      <div className="flex justify-center gap-4">
        <Link href="/dashboard">
          <Button size="lg" className="gap-2">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto flex-grow px-4 py-12">
        {FEATURES.isWaitlistMode ? <WaitlistHero /> : <AppHero />}

        <section className="mx-auto mb-16 grid max-w-5xl gap-8 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-6">
            <X className="mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-3 text-xl font-semibold">X Account Monitoring</h3>
            <p className="text-muted-foreground">
              Track posts from any crypto influencer or project account. Get instant alerts when
              they mention specific tokens or topics.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <LineChart className="mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-3 text-xl font-semibold">Price Alerts</h3>
            <p className="text-muted-foreground">
              Set custom price targets for any cryptocurrency. Get notified when prices cross your
              thresholds.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <Bell className="mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-3 text-xl font-semibold">Instant Notifications</h3>
            <p className="text-muted-foreground">
              Choose between SMS or phone calls for alerts. Never miss a critical market movement or
              influencer post.
            </p>
          </div>
        </section>

        <section className="mx-auto mb-16 max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">How It Works</h2>
            <p className="text-xl text-muted-foreground">
              Start monitoring crypto influencers and prices in minutes
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-2">
            <div className="space-y-6">
              <h3 className="mb-4 text-2xl font-semibold">X Account Monitoring</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">Select Accounts</h4>
                    <p className="text-muted-foreground">
                      Add any X accounts you want to monitor. Track multiple accounts
                      simultaneously.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">Set Keywords</h4>
                    <p className="text-muted-foreground">
                      Define token names or topics you're interested in. Get alerts when these are
                      mentioned.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">Instant Alerts</h4>
                    <p className="text-muted-foreground">
                      Receive immediate notifications when monitored accounts post about your
                      keywords.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="mb-4 text-2xl font-semibold">Price Monitoring</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">Choose Tokens</h4>
                    <p className="text-muted-foreground">
                      Select any cryptocurrency you want to track. Support for all major tokens.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">Set Price Targets</h4>
                    <p className="text-muted-foreground">
                      Define price thresholds for alerts. Set both upper and lower bounds.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">Real-time Notifications</h4>
                    <p className="text-muted-foreground">
                      Get alerts the moment prices cross your defined thresholds.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
