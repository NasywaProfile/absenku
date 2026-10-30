import React from 'react';

export interface BubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'end';
  variant?: 'default' | 'muted' | 'primary';
  children: React.ReactNode;
  className?: string;
}

export function Bubble({ align = 'start', variant = 'default', children, className = '', ...props }: BubbleProps) {
  const isEnd = align === 'end';

  let variantStyles = 'bg-[#007AFF] text-white rounded-2xl rounded-br-xs shadow-2xs';
  if (variant === 'muted' || (!isEnd && variant === 'default')) {
    variantStyles = 'bg-[#E9E9EB] text-slate-900 rounded-2xl rounded-bl-xs';
  } else if (variant === 'primary' || isEnd) {
    variantStyles = 'bg-[#007AFF] text-white rounded-2xl rounded-br-xs shadow-2xs';
  }

  return (
    <div
      className={`relative max-w-[85%] sm:max-w-[78%] px-4 py-2.5 text-xs sm:text-sm font-normal leading-relaxed transition-all ${variantStyles} ${
        isEnd ? 'ml-auto' : 'mr-auto'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function BubbleContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`break-words ${className}`}>{children}</div>;
}

export function BubbleGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-3 w-full ${className}`}>{children}</div>;
}

export function BubbleReactions({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-white shadow-xs border border-slate-200/80 text-[11px] font-semibold text-slate-800 select-none ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function DateDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center my-3">
      <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full shadow-2xs select-none">
        {children}
      </span>
    </div>
  );
}


