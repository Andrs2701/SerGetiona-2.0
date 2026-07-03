'use client';

import { clsx } from 'clsx';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

export default function Avatar({ name, photoUrl, className, style }: AvatarProps) {
  const initials = name
    ? name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?'
    : '?';

  return (
    <div
      className={clsx('rounded-full flex items-center justify-center font-bold shrink-0 overflow-hidden', className)}
      style={style}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
