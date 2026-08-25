import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-gray-light/40">
      <header className="border-b border-gray-cool/60 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/company">
            <Wordmark size="sm" />
          </Link>
          <span className="rounded-full bg-gray-light px-3 py-1 text-xs font-medium text-navy/50">
            Company workspace
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
