import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container mx-auto flex-grow px-4 py-12">
        <Card className="mx-auto max-w-4xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-4xl font-bold">Terms of Service</CardTitle>
            <p className="text-lg text-muted-foreground">Last updated: March 30, 2025</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">1. Acceptance of Terms</h2>
              <p className="text-base leading-7">
                By accessing and using CryptoSentry, you agree to be bound by these Terms of
                Service. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">2. Description of Service</h2>
              <p className="text-base leading-7">
                CryptoSentry provides cryptocurrency price monitoring and social media alert
                services. Our service includes:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li className="text-base">Real-time cryptocurrency price monitoring</li>
                <li className="text-base">
                  Social media alerts for specified accounts and keywords
                </li>
                <li className="text-base">Notification delivery via SMS and phone calls</li>
                <li className="text-base">Customizable alert settings and preferences</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">3. User Accounts</h2>
              <p className="text-base leading-7">To use our service, you must:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li className="text-base">Be at least 18 years old</li>
                <li className="text-base">Register for an account with valid information</li>
                <li className="text-base">Maintain the security of your account credentials</li>
                <li className="text-base">
                  Accept responsibility for all activities under your account
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">4. Subscription and Payments</h2>
              <p className="text-base leading-7">
                Our service is provided on a subscription basis. You agree to:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li className="text-base">
                  Pay all fees associated with your chosen subscription plan
                </li>
                <li className="text-base">Provide valid payment information</li>
                <li className="text-base">
                  Authorize us to charge your payment method for subscription fees
                </li>
                <li className="text-base">
                  Cancel your subscription in accordance with our cancellation policy
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">5. Data Usage and Privacy</h2>
              <p className="text-base leading-7">
                We collect and process data as described in our Privacy Policy. By using our
                service, you consent to our data practices.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">6. Limitation of Liability</h2>
              <p className="text-base leading-7">
                CryptoSentry is provided "as is" without warranties of any kind. We are not liable
                for any damages arising from your use of our service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">7. Changes to Terms</h2>
              <p className="text-base leading-7">
                We reserve the right to modify these terms at any time. Continued use of our service
                after changes constitutes acceptance of the new terms.
              </p>
            </section>

            {/* <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">8. Contact</h2>
              <p className="text-base leading-7">
                For questions about these terms, please contact us at{' '}
                <a href="mailto:support@cryptosentry.com" className="text-primary hover:underline">
                  support@cryptosentry.com
                </a>
              </p>
            </section> */}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
