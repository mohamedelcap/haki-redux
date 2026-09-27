import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Global error boundary: catches render errors anywhere in the tree and shows
 * a branded recovery screen instead of a white page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a lightweight breadcrumb; a telemetry hook can be attached here.
    console.error("[HAKI] Uncaught render error:", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.error) return this.props.children;

    const isAr = (document.documentElement.lang ?? "ar") === "ar";
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center"
      >
        <img
          src="/logo.png"
          alt="HAKI"
          className="mb-6 h-14 w-auto opacity-90"
          loading="eager"
        />
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-500/15">
          <span className="text-2xl" aria-hidden="true">
            ⚠️
          </span>
        </div>
        <h1 className="text-2xl font-black text-foreground">
          {isAr ? "حدث خطأ غير متوقع" : "Something went wrong"}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "نعتذر عن هذا الخلل. جرّب إعادة تحميل الصفحة — إذا استمرت المشكلة تواصل معنا وسنعالجها سريعًا."
            : "Sorry about that. Try reloading the page — if the problem persists, reach out and we'll fix it fast."}
        </p>
        {this.state.error?.message && (
          <p className="mt-4 max-w-lg truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground" dir="ltr">
            {this.state.error.message}
          </p>
        )}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={this.reload}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {isAr ? "أعِد المحاولة" : "Try again"}
          </button>
          <button
            type="button"
            onClick={this.goHome}
            className="rounded-xl border px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
          >
            {isAr ? "الصفحة الرئيسية" : "Go home"}
          </button>
        </div>
      </div>
    );
  }
}
