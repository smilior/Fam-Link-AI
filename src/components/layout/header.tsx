export function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-5 max-w-lg mx-auto">
        <span className="font-bold text-lg bg-gradient-to-r from-brand-500 to-brand-600 bg-clip-text text-transparent">
          Fam-Link
        </span>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
