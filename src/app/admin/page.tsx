import Link from "next/link";
import { requireRole } from "@/lib/auth";
import AdminSectionNav from "@/components/admin-section-nav";
import EmptyState from "@/components/empty-state";
import FeatureCard from "@/components/feature-card";
import PageContainer from "@/components/page-container";
import SubmitButton from "@/components/submit-button";

export default async function AdminPage() {
  const user = await requireRole("admin");

  return (
    <PageContainer
      title="管理员工作台"
      subtitle="这里展示管理员常用入口。当前页面重点是工作区骨架和交互体验，业务数据后续再逐步接入。"
      badge="Admin"
      actions={
        <form action="/api/auth/logout" method="post">
          <SubmitButton
            idleText="退出登录"
            pendingText="退出中..."
            className="secondary-button"
          />
        </form>
      }
    >
      <AdminSectionNav />

      <section className="summary-banner">
        <div>
          <h2>你当前是管理员</h2>
          <p>
            当前登录账号：{user.name}（{user.username}）
          </p>
        </div>
        <span className="status-pill status-admin">已进入管理员后台</span>
      </section>

      <section className="feature-grid">
        <FeatureCard
          icon="A1"
          title="讲次管理"
          description="查看讲义列表、创建新讲义，并从讲义页继续进入编辑或分配任务流程。"
          footer={
            <Link href="/admin/lectures" className="text-link">
              进入讲义管理
            </Link>
          }
        />
        <FeatureCard
          icon="A2"
          title="老师列表"
          description="查看当前老师账号和已分配任务数量，并快速发起任务分配。"
          footer={
            <Link href="/admin/teachers" className="text-link">
              查看老师列表
            </Link>
          }
        />
        <FeatureCard
          icon="A3"
          title="任务分配"
          description="为某个老师创建任务，自动绑定讲义、生成分支名并初始化 main.tex 草稿。"
          footer={
            <Link href="/admin/tasks/assign" className="text-link">
              去分配任务
            </Link>
          }
        />
        <FeatureCard
          icon="A4"
          title="审核任务"
          description="查看老师已提交的任务，进入 PDF 预览与源码差异页面，并执行退回修改或合并到主分支。"
          footer={
            <Link href="/admin/reviews" className="text-link">
              进入审核列表
            </Link>
          }
        />
      </section>

      <EmptyState
        title="暂无统计数据"
        description="这里后续可以接入讲次数量、待审核任务、老师活跃情况等后台统计信息。"
      />
    </PageContainer>
  );
}
