"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/teacher/tasks", label: "我的任务" },
];

export default function TeacherSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="sub-nav" aria-label="老师二级导航">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`sub-nav-link ${active ? "is-active" : ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
