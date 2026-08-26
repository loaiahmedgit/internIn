import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { getCurrentUser } from "@/lib/auth";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const dashboardHref = user ? (user.role === "company" ? "/company/dashboard" : "/student/dashboard") : null;

  return (
    <div className="flex min-h-full flex-col">
      <Navbar dashboardHref={dashboardHref} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
