"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/lectures", label: "讲义管理" },
  { href: "/admin/teachers", label: "老师列表" },
  { href: "/admin/tasks/assign", label: "任务分配" },
  { href: "/admin/reviews", label: "审核任务" },
];

export default function AdminSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="sub-nav" aria-label="管理员二级导航">
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
