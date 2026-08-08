import { Card } from './ui';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-neutral-200 rounded-lg animate-pulse ${className}`} />
  );
}

export function PageSkeleton() {
  return (
    <div className="py-4 space-y-4" aria-busy="true" aria-label="Chargement en cours">
      {/* Card skeleton */}
      <Card className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </Card>

      {/* Stats skeleton */}
      <Card className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-1.5 w-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </Card>

      {/* Session list skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="w-2 h-2 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-36" />
          </Card>
        ))}
      </div>
    </div>
  );
}
