'use client';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-[var(--background-light)] to-[var(--background-dark)] ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="gradient-border p-6 bg-[var(--background-light)]">
      <Skeleton className="h-8 w-3/4 mb-4 rounded-lg" />
      <Skeleton className="h-4 w-full mb-2 rounded" />
      <Skeleton className="h-4 w-5/6 rounded" />
    </div>
  );
}

export function ProposalSkeleton() {
  return (
    <div className="gradient-border p-6 bg-[var(--background-light)]">
      <div className="flex justify-between items-start mb-4">
        <Skeleton className="h-8 w-2/3 rounded-lg" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full mb-2 rounded" />
      <Skeleton className="h-4 w-5/6 mb-6 rounded" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}
