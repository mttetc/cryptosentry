import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container mx-auto flex-grow px-4 py-12">
        <Card className="mx-auto max-w-4xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-4xl font-bold">Privacy Policy</CardTitle>
            <p className="text-lg text-muted-foreground">Last updated: March 30, 2025</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">1. Information We Collect</h2>
              <p className="text-base leading-7">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li className="text-base">Account information (name, email, phone number)</li>
                <li className="text-base">
                  Payment information (processed securely through our payment providers)
                </li>
                <li className="text-base">Alert preferences and settings</li>
                <li className="text-base">Communication preferences</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">2. How We Use Your Information</h2>
              <p className="text-base leading-7">We use the collected information to:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li className="text-base">Provide and maintain our service</li>
                <li className="text-base">Process your payments</li>
                <li className="text-base">Send you alerts and notifications</li>
                <li className="text-base">Improve our service and user experience</li>
                <li className="text-base">
                  Communicate with you about your account and our service
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">3. Information Sharing</h2>
              <p className="text-base leading-7">
                We do not sell your personal information. We may share your information with:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li className="text-base">Service providers who assist in operating our service</li>
                <li className="text-base">Payment processors for handling transactions</li>
                <li className="text-base">Communication providers for sending alerts</li>
                <li className="text-base">Law enforcement when required by law</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">4. Data Security</h2>
              <p className="text-base leading-7">
                We implement appropriate security measures to protect your personal information,
                including:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li className="text-base">Encryption of sensitive data</li>
                <li className="text-base">Regular security assessments</li>
                <li className="text-base">Access controls and authentication</li>
                <li className="text-base">Secure data storage and transmission</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">5. Your Rights</h2>
              <p className="text-base leading-7">You have the right to:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li className="text-base">Access your personal information</li>
                <li className="text-base">Correct inaccurate information</li>
                <li className="text-base">Request deletion of your information</li>
                <li className="text-base">Opt-out of marketing communications</li>
                <li className="text-base">Export your data</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">6. Cookies and Tracking</h2>
              <p className="text-base leading-7">
                We use cookies and similar tracking technologies to:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li className="text-base">Maintain your session</li>
                <li className="text-base">Remember your preferences</li>
                <li className="text-base">Analyze service usage</li>
                <li className="text-base">Improve our service</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">7. Children&apos;s Privacy</h2>
              <p className="text-base leading-7">
                Our service is not intended for children under 18. We do not knowingly collect
                personal information from children.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">8. Changes to Privacy Policy</h2>
              <p className="text-base leading-7">
                We may update this privacy policy from time to time. We will notify you of any
                changes by posting the new policy on this page.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">9. Contact Us</h2>
              <p className="text-base leading-7">
                For questions about this privacy policy, please contact us at{' '}
                <a href="mailto:privacy@cryptosentry.com" className="text-primary hover:underline">
                  privacy@cryptosentry.com
                </a>
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
