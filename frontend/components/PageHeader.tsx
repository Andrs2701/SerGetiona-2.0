import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            {breadcrumbs.map((item, index) => (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && <ChevronRight size={12} />}
                {item.href ? (
                  <Link href={item.href} className="hover:text-indigo-600 transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-gray-700 font-medium">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
