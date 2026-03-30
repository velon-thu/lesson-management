import Link from "next/link";
import { UserRole } from "@prisma/client";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";
import SubmitButton from "@/components/submit-button";
import { prisma } from "@/lib/prisma";
import { requireSystemSettingsAccess } from "@/lib/system-settings";
import {
  createManagedUserAction,
  deactivateManagedUserAction,
} from "@/app/system-settings/actions";

type PageProps = {
  searchParams?: {
    success?: string;
    error?: string;
  };
};

export default async function SystemSettingsPage({ searchParams }: PageProps) {
  await requireSystemSettingsAccess();

  const users = await prisma.user.findMany({
    where: {
      role: {
        in: [UserRole.ADMIN, UserRole.TEACHER],
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      username: true,
      role: true,
      passwordPlain: true,
      isActive: true,
      createdAt: true,
    },
  });

  const error = searchParams?.error ?? "";
  const success = searchParams?.success ?? "";

  return (
    <PageContainer
      title="系统设置"
      badge="Settings"
      actions={
        <Link href="/" className="secondary-link-button">
          返回主页面
        </Link>
      }
    >
      {success === "created" ? (
        <div className="feedback-banner success">新账号已创建成功。</div>
      ) : null}
      {success === "deleted" ? (
        <div className="feedback-banner success">账号已删除。</div>
      ) : null}
      {error ? <div className="feedback-banner error">{error}</div> : null}

      {users.length === 0 ? (
        <EmptyState title="暂无账号" description="当前还没有管理员或老师账号。" />
      ) : (
        <section className="form-card">
          <div className="section-heading">
            <h3>当前账号信息</h3>
          </div>
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>角色</th>
                  <th>用户名</th>
                  <th>密码</th>
                  <th>注销账号</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.role === "ADMIN" ? "管理员" : "老师"}</td>
                    <td>{user.username || "-"}</td>
                    <td>{user.passwordPlain || "未记录"}</td>
                    <td>
                      {user.username ? (
                        <form action={deactivateManagedUserAction} className="inline-action-form">
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="expectedUsername" value={user.username} />
                          <input
                            name="confirmedUsername"
                            type="text"
                            placeholder={`输入 ${user.username} 注销`}
                          />
                          <button type="submit" className="secondary-button compact-button">
                            注销
                          </button>
                        </form>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="form-card">
        <div className="section-heading">
          <h3>新建账号</h3>
        </div>
        <form action={createManagedUserAction} className="admin-form-grid">
          <label className="form-field">
            <span>用户名</span>
            <input name="username" type="text" placeholder="请输入用户名" />
          </label>
          <label className="form-field">
            <span>密码</span>
            <input name="password" type="text" placeholder="请输入登录密码" />
          </label>
          <label className="form-field">
            <span>角色</span>
            <select name="role" defaultValue="TEACHER">
              <option value="TEACHER">老师</option>
              <option value="ADMIN">管理员</option>
            </select>
          </label>
          <div className="form-actions form-field-full">
            <SubmitButton
              idleText="创建账号"
              pendingText="创建中..."
              className="primary-button"
            />
          </div>
        </form>
      </section>
    </PageContainer>
  );
}
