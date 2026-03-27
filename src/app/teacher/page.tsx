import { requireRole } from "@/lib/auth";
import EmptyState from "@/components/empty-state";
import FeatureCard from "@/components/feature-card";
import PageContainer from "@/components/page-container";
import SubmitButton from "@/components/submit-button";

export default async function TeacherPage() {
  const user = await requireRole("teacher");

  return (
    <PageContainer
      title="老师工作台"
      subtitle="这里展示老师端常见入口。当前以操作引导和页面结构为主，真实业务稍后接入。"
      badge="Teacher"
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
      <section className="summary-banner">
        <div>
          <h2>你当前是老师</h2>
          <p>
            当前登录账号：{user.name}（{user.username}）
          </p>
        </div>
        <span className="status-pill status-teacher">已进入老师工作台</span>
      </section>

      <section className="feature-grid">
        <FeatureCard
          icon="T1"
          title="我的任务"
          description="查看属于自己的任务列表和当前处理进度。当前为 UI 占位。"
        />
        <FeatureCard
          icon="T2"
          title="编辑讲义"
          description="进入讲义编辑流程，后续可接入草稿与版本管理。当前为 UI 占位。"
        />
        <FeatureCard
          icon="T3"
          title="编译预览"
          description="查看编译结果、错误反馈和预览文件。当前为 UI 占位。"
        />
        <FeatureCard
          icon="T4"
          title="提交审核"
          description="提交当前讲义或任务成果，进入审核流程。当前为 UI 占位。"
        />
      </section>

      <section className="tips-panel">
        <h3>权限验证示例</h3>
        <p>
          你可以访问 <code>/api/tasks/teacher-demo-task</code> 查看自己的任务数据。
        </p>
        <p>
          如果访问 <code>/api/tasks/admin-demo-task</code>，服务端会返回友好的 403 提示。
        </p>
      </section>

      <EmptyState
        title="暂无已加载任务"
        description="老师工作台当前还没有接入真实任务列表，这里先保留为空状态占位。"
      />
    </PageContainer>
  );
}
