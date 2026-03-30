import { getCurrentUser } from "@/lib/auth";
import SubmitButton from "@/components/submit-button";

export default async function Header() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <header className="site-header">
      <div className="site-shell site-header-inner">
        <div className="site-header-nav">
          <div className="site-header-actions">
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
          </div>
        </div>
      </div>
    </header>
  );
}
