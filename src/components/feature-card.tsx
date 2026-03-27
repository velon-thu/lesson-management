import type { ReactNode } from "react";

type FeatureCardProps = {
  title: string;
  description: string;
  icon?: string;
  footer?: ReactNode;
};

export default function FeatureCard({
  title,
  description,
  icon,
  footer,
}: FeatureCardProps) {
  return (
    <article className="feature-card">
      <div className="feature-card-body">
        {icon ? <span className="feature-icon">{icon}</span> : null}
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {footer ? <div className="feature-card-footer">{footer}</div> : null}
    </article>
  );
}
