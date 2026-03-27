import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import SubmitButton from "@/components/submit-button";

export default async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="site-header">
      <div className="site-shell site-header-inner">
        <div className="site-brand">
          <Link href="/" className="site-logo">
            中佳九学讲义管理系统
          </Link>
        </div>
        <div className="site-header-nav">
          <div className="site-header-actions">
            {user ? (
              <>
                <span className="site-user">
                  当前身份：{user.role === "admin" ? "管理员" : "老师"}
                </span>
                <form action="/api/auth/logout" method="post">
                  <SubmitButton
                    idleText="退出登录"
                    pendingText="退出中..."
                    className="secondary-button"
                  />
                </form>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
