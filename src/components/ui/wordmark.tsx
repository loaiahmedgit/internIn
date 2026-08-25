import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The actual internIn logo (public/logo.png), background stripped to
 * transparent so it composites directly onto any surface — no chip/box.
 */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "reverse";
}) {
  const heightClass = {
    sm: "h-8",
    md: "h-11",
    lg: "h-20",
  }[size];

  return (
    <Image
      src="/logo.png"
      alt="internIn"
      width={1063}
      height={285}
      unoptimized
      priority
      className={cn(heightClass, "w-auto", className)}
    />
  );
}
