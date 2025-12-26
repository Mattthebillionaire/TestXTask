import { Sidebar } from '@/components/features/shared';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Sidebar />
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
