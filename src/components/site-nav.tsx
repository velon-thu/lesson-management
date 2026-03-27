import Link from "next/link";

const links = [
  { href: "/", label: "首页" },
  { href: "/login", label: "登录" },
  { href: "/admin", label: "管理员" },
  { href: "/teacher", label: "老师" },
];

export default function SiteNav() {
  return (
    <header className="site-header">
      <div className="site-shell site-header-inner">
        <Link href="/" className="site-logo">
          中佳九学讲义管理系统
        </Link>
        <nav className="site-nav" aria-label="主导航">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="site-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
