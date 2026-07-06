import { AppHeader } from "@/shared/components/layout/AppHeader";
import { TeacherRequestForm } from "../components/TeacherRequestForm";

export function TeacherRequestPage() {
  return (
    <>
      <AppHeader variant="auth" />
      <div className="flex h-[calc(100vh-73px)] flex-col overflow-hidden lg:flex-row">
        {/* Form Panel */}
        <main className="flex w-full flex-col items-center overflow-y-auto bg-gray-100 px-4 py-4 lg:w-3/5 lg:px-8 lg:py-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]" style={{ msOverflowStyle: 'none' }}>
          <TeacherRequestForm />
        </main>

        {/* Hero Panel */}
        <aside className="hidden w-full flex-col items-center justify-center bg-hero-gradient px-6 py-12 text-center lg:flex lg:w-2/5 lg:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl border border-cyan-500/30 bg-navy-800">
            <svg className="text-cyan-500" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold text-white">
            كن معلمًا
            <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-sm font-bold text-white">
              ف
            </span>
          </h1>

          <p className="mt-3 max-w-sm text-body text-gray-300">
            قدّم طلبك وانضم لفريق المعلمين — سنراجعه ونتواصل معك.
          </p>

          <div className="mt-8 space-y-4 text-right">
            {[
              "درّس آلاف الطلاب",
              "جدول مرن من أي مكان",
              "فريق دعم متخصص",
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <svg className="shrink-0 text-cyan-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-body text-white">{text}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
