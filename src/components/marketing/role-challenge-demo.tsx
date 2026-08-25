"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Check, Clock3, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const demos = {
  Data: {
    prompt: "We need a student who can clean sales data, use basic SQL, and explain insights clearly.",
    title: "Sales performance challenge",
    scenario: "Find why electronics revenue fell 14% and recommend three actions.",
    skills: ["Excel", "SQL", "Reasoning"],
    file: "transactions.csv",
    minutes: 75,
  },
  Marketing: {
    prompt: "We need an intern to analyze campaigns, research competitors, and present a clear launch plan.",
    title: "Campaign launch challenge",
    scenario: "Review a fictional campaign and propose a focused launch plan for a new product.",
    skills: ["Research", "Analytics", "Writing"],
    file: "campaign-data.xlsx",
    minutes: 90,
  },
  Design: {
    prompt: "We need a junior designer who can understand a brief, prioritize information, and explain decisions.",
    title: "Product onboarding challenge",
    scenario: "Improve a fictional onboarding flow and explain the reasoning behind your hierarchy.",
    skills: ["UX", "Hierarchy", "Rationale"],
    file: "product-brief.pdf",
    minutes: 80,
  },
} as const;

type DemoRole = keyof typeof demos;

export function RoleChallengeDemo() {
  const [role, setRole] = useState<DemoRole>("Data");
  const reduceMotion = useReducedMotion();
  const demo = demos[role];

  return (
    <div className="border border-navy/12 bg-white">
      <div className="flex flex-col gap-4 border-b border-navy/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-navy/68 uppercase">Live challenge preview</p>
          <p className="mt-1 text-sm font-medium text-navy">Choose a role to change the assessment</p>
        </div>
        <div className="flex rounded-lg bg-gray-light p-1" role="group" aria-label="Challenge role">
          {(Object.keys(demos) as DemoRole[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={role === item}
              onClick={() => setRole(item)}
              className={cn(
                "min-h-9 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
                role === item ? "bg-white text-navy shadow-sm" : "text-navy/68 hover:text-navy",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={role}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="grid lg:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="border-b border-navy/10 bg-gray-light/50 p-6 lg:border-r lg:border-b-0">
            <p className="text-[11px] font-semibold text-teal-ink">MANAGER</p>
            <p className="mt-3 text-sm leading-6 text-navy/75">{demo.prompt}</p>
            <div className="mt-8 flex items-center gap-2 text-xs text-navy/68">
              <span className="flex size-7 items-center justify-center rounded-full bg-teal/10 text-teal-ink">
                <Check className="size-3.5" aria-hidden="true" />
              </span>
              Structured by internIn AI
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold text-teal-ink">GENERATED CHALLENGE</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-navy">{demo.title}</h3>
              </div>
              <ShieldCheck className="size-5 shrink-0 text-teal-ink" aria-label="Safe simulated data" />
            </div>
            <p className="mt-4 max-w-lg text-sm leading-6 text-navy/68">{demo.scenario}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {demo.skills.map((skill) => (
                <span key={skill} className="rounded-full border border-navy/10 px-2.5 py-1 text-xs text-navy/68">{skill}</span>
              ))}
            </div>
            <div className="mt-7 grid grid-cols-2 border-t border-navy/10 pt-5 text-xs text-navy/68">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-teal-ink" aria-hidden="true" /> {demo.file}
              </span>
              <span className="flex items-center justify-end gap-2">
                <Clock3 className="size-4 text-teal-ink" aria-hidden="true" /> {demo.minutes} minutes
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
