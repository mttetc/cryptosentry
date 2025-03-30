import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-12 border-t py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex gap-8">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms of Service
            </Link>
          </div>
          <div>© {new Date().getFullYear()} CryptoSentry. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
