import { motion } from "framer-motion";
import { HakiLogo } from "@/components/HakiLogo";
import { Home } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="hero-gradient flex min-h-screen flex-col"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <HakiLogo variant="colored" size={72} />
        <h1 className="mt-8 text-6xl font-black text-foreground">404</h1>
        <p className="mt-3 text-xl font-bold">الصفحة غير موجودة</p>
        <p className="mt-2 max-w-sm leading-relaxed text-muted-foreground">
          يبدو أن هذه الصفحة انتقلت إلى رفٍّ آخر. جرّب العودة إلى المكتبة أو استخدم شريط التنقل بالأعلى.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            <Home className="size-4" />
            الصفحة الرئيسية
          </Link>
          <Link
            to="/browse"
            className="inline-flex h-11 items-center gap-2 rounded-lg border bg-background px-6 text-sm font-bold transition-colors hover:bg-muted"
          >
            تصفح المكتبة
          </Link>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">حكي © 2026</p>
      </div>
    </motion.div>
  );
}
