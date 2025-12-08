'use client';

export function SkeletonCard() {
  return (
    <div className="snap-start rounded-3xl border border-black/5 bg-white/80 shadow-lg shadow-black/5 backdrop-blur-sm dark:border-white/10 dark:bg-gray-900/70 dark:shadow-none">
      <div className="relative h-[72vh] w-full overflow-hidden rounded-3xl sm:h-[60vh]">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 animate-pulse dark:from-gray-800 dark:via-gray-700 dark:to-gray-800" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="h-9 w-9 rounded-full bg-white/70 shadow-inner animate-pulse dark:bg-gray-800" />
          <span className="h-4 w-24 rounded-full bg-white/70 animate-pulse dark:bg-gray-800" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 space-y-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6">
          <div className="h-3 w-1/2 rounded-full bg-white/80 animate-pulse" />
          <div className="h-5 w-3/4 rounded-full bg-white/90 animate-pulse" />
          <div className="h-5 w-2/3 rounded-full bg-white/80 animate-pulse" />
        </div>
      </div>
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-3 w-20 rounded-full bg-gray-200 animate-pulse dark:bg-gray-800" />
        <div className="h-4 w-full rounded-full bg-gray-200 animate-pulse dark:bg-gray-800" />
        <div className="h-4 w-5/6 rounded-full bg-gray-200 animate-pulse dark:bg-gray-800" />
      </div>
    </div>
  );
}
