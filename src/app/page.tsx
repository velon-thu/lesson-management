import Link from "next/link";
import PageContainer from "@/components/page-container";
import SubmitButton from "@/components/submit-button";
import { getCurrentUser, getRedirectPathByRole } from "@/lib/auth";

const errorMessages: Record<string, string> = {
  "请输入用户名和密码": "请输入用户名和密码",
  "用户名或密码错误": "用户名或密码错误",
};

type HomePageProps = {
  searchParams?: {
    role?: string;
    error?: string;
  };
};

export default async function Home({ searchParams }: HomePageProps) {
  const user = await getCurrentUser();
  const selectedRole =
    searchParams?.role === "admin" || searchParams?.role === "teacher"
      ? searchParams.role
      : null;
  const error = searchParams?.error ? errorMessages[searchParams.error] ?? "登录失败" : null;

  if (user && !selectedRole) {
    return (
      <PageContainer title="欢迎使用中佳九学讲义管理系统" badge="系统首页">
        <section className="role-grid">
          <Link href="/admin" className="role-card">
            管理员
          </Link>
          <Link href="/teacher" className="role-card">
            老师
          </Link>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="欢迎使用中佳九学讲义管理系统" badge="系统首页" centered>
      {selectedRole ? (
        <div className="auth-layout">
          <section className="auth-card">
            <div className="auth-intro">
              <h2>{selectedRole === "admin" ? "管理员" : "老师"}</h2>
            </div>
            <form action="/api/auth/login" method="post" className="auth-form">
              <input type="hidden" name="role" value={selectedRole} />
              <label className="form-field">
                <span>用户名</span>
                <input name="username" type="text" placeholder="请输入用户名" />
              </label>
              <label className="form-field">
                <span>密码</span>
                <input name="password" type="password" placeholder="请输入密码" />
              </label>
              {error ? (
                <p className="form-error">{error}</p>
              ) : (
                <p className="form-hint">请输入账号密码后登录。</p>
              )}
              <SubmitButton idleText="登录" pendingText="登录中..." className="primary-button" />
            </form>
            <div className="login-hint">
              <h3>测试账号</h3>
              <p>
                管理员：<code>admin / admin123456</code>
              </p>
              <p>
                老师：<code>teacher / teacher123456</code>
              </p>
              <Link href="/" className="text-link">
                返回角色选择
              </Link>
            </div>
          </section>
        </div>
      ) : (
        <section className="role-grid">
          <Link href="/?role=admin" className="role-card">
            管理员
          </Link>
          <Link href="/?role=teacher" className="role-card">
            老师
          </Link>
        </section>
      )}
    </PageContainer>
  );
}
