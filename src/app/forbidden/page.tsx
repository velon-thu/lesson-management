import Link from "next/link";
import PageContainer from "@/components/page-container";

export default function ForbiddenRoutePage() {
  return (
    <PageContainer
      title="无权限访问"
      subtitle="当前任务不属于你的账号，系统已在服务端阻止访问。"
      badge="403"
      centered
    >
      <section className="empty-state">
        <h3>你没有权限查看这个资源</h3>
        <p>请返回我的任务列表，查看系统分配给你的任务内容。</p>
        <Link href="/teacher/tasks" className="primary-link-button">
          返回我的任务
        </Link>
      </section>
    </PageContainer>
  );
}
