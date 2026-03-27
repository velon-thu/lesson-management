import type { ReactNode } from "react";

type PageContainerProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
  centered?: boolean;
  children: ReactNode;
};

export default function PageContainer({
  title,
  subtitle,
  badge,
  actions,
  centered = false,
  children,
}: PageContainerProps) {
  return (
    <main className={`page ${centered ? "page-centered" : ""}`}>
      <div className="site-shell">
        <section className="page-panel">
          <div className="page-header">
            <div className="page-heading">
              {badge ? <span className="page-badge">{badge}</span> : null}
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {actions ? <div className="page-actions">{actions}</div> : null}
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
