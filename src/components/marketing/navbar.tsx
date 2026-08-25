"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/#for-students", label: "For Students" },
  { href: "/#for-companies", label: "For Companies" },
  { href: "/#product", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-white/95 backdrop-blur-md">
      <div className="border-b border-navy/8 bg-gray-light/55">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-center px-5 text-center text-[11px] text-navy/68 sm:px-8 lg:px-10">
          <span className="font-medium text-navy">Free to start.</span>
          <span className="ml-1.5 hidden sm:inline">Pay only when you hire an intern.</span>
          <Link href="/#pricing" className="ml-2 inline-flex items-center gap-0.5 font-semibold text-teal-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
            See pricing <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="relative mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link href="/" aria-label="internIn home" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal">
          <Wordmark className="h-10 sm:h-11" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-navy/68 transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button render={<Link href="/signin" />} nativeButton={false} variant="ghost" className="h-10 rounded-full px-4 text-navy hover:bg-gray-light">
            Sign in
          </Button>
          <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} className="h-10 rounded-full bg-teal-ink px-4 text-white hover:bg-[#0b625c]">
            Get started <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
          </Button>
        </div>

        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
          className="flex size-11 cursor-pointer items-center justify-center rounded-full text-navy transition-colors hover:bg-gray-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal md:hidden"
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>

        {open && (
          <div id="mobile-navigation" className="absolute inset-x-4 top-[calc(100%+1px)] border border-navy/10 bg-white p-4 shadow-[0_18px_50px_rgba(33,50,72,0.12)] md:hidden">
            <nav aria-label="Mobile navigation" className="flex flex-col">
              {links.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center border-b border-navy/8 text-sm font-medium text-navy/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
                  {link.label}
                </Link>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button render={<Link href="/signin" onClick={() => setOpen(false)} />} nativeButton={false} variant="outline" className="h-11 rounded-full border-navy/15 text-navy">
                  Sign in
                </Button>
                <Button render={<Link href="/company/opportunities/new" onClick={() => setOpen(false)} />} nativeButton={false} className="h-11 rounded-full bg-teal-ink text-white hover:bg-[#0b625c]">
                  Get started
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
