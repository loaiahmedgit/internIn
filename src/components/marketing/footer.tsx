import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";

const columns = [
  { title: "For talent", links: [["Find internships", "/signup?role=student"], ["How challenges work", "/#product"], ["Verified experience", "/#for-students"]] },
  { title: "For companies", links: [["Create an internship", "/company/opportunities/new"], ["Candidate evidence", "/#for-companies"], ["Pricing", "/#pricing"]] },
  { title: "Product", links: [["Challenge builder", "/#product"], ["Internship programs", "/#product"], ["Sign in", "/signin"]] },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-navy/10 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1.8fr]">
          <div>
            <Wordmark className="h-12" />
            <p className="mt-5 max-w-xs text-sm leading-6 text-navy/68">Connecting ambition with opportunity through evidence, structure, and a fair first chance.</p>
            <p className="mt-8 flex items-center gap-2 text-xs font-medium text-teal-ink"><span className="size-2 rounded-full bg-teal" aria-hidden="true" /> Building in Qatar</p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-xs font-semibold text-navy">{column.title}</h2>
                <ul className="mt-5 space-y-3">
                  {column.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="text-sm text-navy/68 transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-navy/10 pt-6 text-xs text-navy/68 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} internIn. All rights reserved.</p>
          <div className="flex gap-5"><Link href="#" className="hover:text-navy">Privacy</Link><Link href="#" className="hover:text-navy">Terms</Link></div>
        </div>
      </div>
    </footer>
  );
}
