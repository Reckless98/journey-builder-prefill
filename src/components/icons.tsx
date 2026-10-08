import type { ReactNode } from 'react';

/** Decorative 16px line icons. They are hidden from assistive technology; label the control. */
function Icon({ children, className = 'size-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

interface IconProps {
  className?: string;
}

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="m10.25 10.25 3 3" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </Icon>
);

export const WarningIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2.25 14.25 13H1.75L8 2.25Z" />
    <path d="M8 6.5v3M8 11.25v.01" />
  </Icon>
);

export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l2-2a2.75 2.75 0 0 0-3.9-3.9l-.75.75" />
    <path d="M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-2 2a2.75 2.75 0 0 0 3.9 3.9l.75-.75" />
  </Icon>
);
