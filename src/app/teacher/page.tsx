import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function TeacherPage() {
  await requireRole("teacher");
  redirect("/teacher/tasks");
}
