import { getCurrentUser } from "@/lib/auth";
import { StudentAppShell } from "@/components/student/student-app-shell";
import { getActiveInternshipSummary } from "@/lib/opportunities/active-internship";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const activeInternship = user ? await getActiveInternshipSummary(user.id) : null;

  return (
    <StudentAppShell displayName={user?.fullName ?? "Student"} activeInternship={activeInternship}>
      {children}
    </StudentAppShell>
  );
}
