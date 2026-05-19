import Link from "next/link";
import SubmitButton from "@/components/submit-button";
import SystemSettingsEntry from "@/components/system-settings-entry";
import { getCurrentUser } from "@/lib/auth";

const errorMessages: Record<string, string> = {
  "请输入用户名和密码": "请输入用户名和密码",
  "用户名或密码错误": "用户名或密码错误",
};

type HomePageProps = {
  searchParams?: {
    role?: string;
    error?: string;
    settingsError?: string;
  };
};

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 6.6C10.4 5.1 7.9 4.5 4 4.5v13c3.9 0 6.4.6 8 2.1 1.6-1.5 4.1-2.1 8-2.1v-13c-3.9 0-6.4.6-8 2.1Z" />
      <path d="M12 6.6V19.6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.2 19 6v5.2c0 4.6-3 8.2-7 9.8-4-1.6-7-5.2-7-9.8V6Z" />
      <path d="M9 11.8 11.2 14 15.2 10" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M5.2 20c.4-3.7 3.3-5.8 6.8-5.8s6.4 2.1 6.8 5.8" />
    </svg>
  );
}

function WelcomeBrand() {
  return (
    <div className="welcome-brand">
      <span className="welcome-logo">
        <BookIcon />
      </span>
      <h1 className="welcome-title">欢迎使用中佳九学讲义管理系统</h1>
    </div>
  );
}

export default async function Home({ searchParams }: HomePageProps) {
  const user = await getCurrentUser();
  const selectedRole =
    searchParams?.role === "admin" || searchParams?.role === "teacher"
      ? searchParams.role
      : null;
  const error = searchParams?.error ? errorMessages[searchParams.error] ?? "登录失败" : null;
  const settingsError = searchParams?.settingsError ?? "";

  if (selectedRole) {
    return (
      <main className="welcome welcome-auth">
        <div className="welcome-inner">
          <WelcomeBrand />
          <section className="auth-card">
            <div className="auth-intro">
              <h2>{selectedRole === "admin" ? "管理员登录" : "老师登录"}</h2>
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
              {error ? <p className="form-error">{error}</p> : null}
              <SubmitButton idleText="登录" pendingText="登录中..." className="primary-button" />
            </form>
            <div className="login-hint">
              <Link href="/" className="text-link">
                返回角色选择
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const adminHref = user ? "/admin" : "/?role=admin";
  const teacherHref = user ? "/teacher" : "/?role=teacher";

  return (
    <main className="welcome">
      <div className="welcome-inner">
        <WelcomeBrand />
        <section className="welcome-cards">
          <Link href={adminHref} className="welcome-card welcome-card-admin">
            <span className="welcome-card-icon">
              <ShieldIcon />
            </span>
            <span className="welcome-card-label">管理员</span>
          </Link>
          <Link href={teacherHref} className="welcome-card welcome-card-teacher">
            <span className="welcome-card-icon">
              <PersonIcon />
            </span>
            <span className="welcome-card-label">老师</span>
          </Link>
          <SystemSettingsEntry error={settingsError} defaultOpen={Boolean(settingsError)} />
        </section>
      </div>
    </main>
  );
}
