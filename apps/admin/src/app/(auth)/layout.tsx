export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bone px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-3xl font-semibold tracking-tight text-ink-900">Reloaded.</span>
          <span className="label-caps">admin</span>
        </div>
        {children}
      </div>
    </main>
  );
}
