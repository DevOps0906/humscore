"use client";

const SIZE_CLASSES = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
} as const;

interface LoadingSpinnerProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label="로딩 중"
      className={`animate-spin rounded-full border-ink-soft border-t-accent ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}
