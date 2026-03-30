import type { ReactNode } from "react";

type PageContainerProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
  centered?: boolean;
  wide?: boolean;
  hideHeader?: boolean;
  children: ReactNode;
};

export default function PageContainer({
  title,
  subtitle,
  badge,
  actions,
  centered = false,
  wide = false,
  hideHeader = false,
  children,
}: PageContainerProps) {
  return (
    <main className={`page ${centered ? "page-centered" : ""}`}>
      <div className={`site-shell ${wide ? "site-shell-wide" : ""}`}>
        <section className={`page-panel ${wide ? "page-panel-wide" : ""}`}>
          {hideHeader ? null : (
            <div className="page-header">
              <div className="page-heading">
                {badge ? <span className="page-badge">{badge}</span> : null}
                <h1>{title}</h1>
                {subtitle ? <p>{subtitle}</p> : null}
              </div>
              {actions ? <div className="page-actions">{actions}</div> : null}
            </div>
          )}
          {children}
        </section>
      </div>
    </main>
  );
}
