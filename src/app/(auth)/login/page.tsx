import { redirect } from "next/navigation";
import { getCurrentUser, getRedirectPathByRole } from "@/lib/auth";

export default async function LoginPage({
}: {
  searchParams?: { error?: string };
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect(getRedirectPathByRole(user.role));
  }

  redirect("/");
}
