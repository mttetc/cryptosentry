import Link from 'next/link';

interface LogoProps {
  className?: string;
}

export function Logo({ className = '' }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield outline */}
        <path
          d="M16 2L4 8V16C4 22.6274 9.37258 28 16 28C22.6274 28 28 22.6274 28 16V8L16 2Z"
          stroke="#3B82F6"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        {/* Crypto symbol */}
        <path d="M16 8L12 12L16 16L20 12L16 8Z" fill="#3B82F6" />
        <path d="M16 16L12 20L16 24L20 20L16 16Z" fill="#3B82F6" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">CryptoSentry</span>
    </Link>
  );
}
