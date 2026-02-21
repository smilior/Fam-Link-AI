import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 bg-slate-50">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-500 to-brand-600 bg-clip-text text-transparent">
          Tsunagu
        </h1>
        <p className="text-slate-500 text-lg">
          家族をつなぐ
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-3.5 h-3.5 rounded-full bg-papa-500 dot-anim-1" />
        <span className="w-3.5 h-3.5 rounded-full bg-mama-500 dot-anim-2" />
        <span className="w-3.5 h-3.5 rounded-full bg-daughter-500 dot-anim-3" />
        <span className="w-3.5 h-3.5 rounded-full bg-son-500 dot-anim-4" />
      </div>
      <Link
        href="/login"
        className="mt-4 px-6 py-3 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors"
      >
        ログインへ
      </Link>
    </main>
  );
}
