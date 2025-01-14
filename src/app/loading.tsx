import { Header } from '@/components/layout/Header';
import { CardSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--background-dark)]">
      <Header />
      
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="container mx-auto max-w-6xl">
          <div className="h-20 w-3/4 mb-8 bg-gradient-to-r from-[var(--background-light)] to-[var(--background-dark)] animate-pulse rounded-lg" />
          <div className="h-12 w-1/2 mb-12 bg-gradient-to-r from-[var(--background-light)] to-[var(--background-dark)] animate-pulse rounded-lg" />
          <div className="h-14 w-40 bg-gradient-to-r from-[var(--background-light)] to-[var(--background-dark)] animate-pulse rounded-lg" />
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Background Gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] opacity-30">
          <div className="absolute inset-0 rotate-45 translate-y-[-60%] blur-3xl">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-[var(--primary)] to-transparent" />
          </div>
        </div>
      </div>
    </main>
  );
}
