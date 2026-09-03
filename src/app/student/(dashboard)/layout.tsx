import { getCurrentUser } from "@/lib/auth";
import { StudentAppShell } from "@/components/student/student-app-shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return <StudentAppShell displayName={user?.fullName ?? "Student"}>{children}</StudentAppShell>;
}
