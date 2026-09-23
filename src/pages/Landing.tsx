import { motion } from "framer-motion";
import { HakiLogo } from "@/components/HakiLogo";

/** صفحة تمهيدية قديمة — لم تعد مرتبطة بأي مسار؛ الرئيسية الآن في pages/Home.tsx */
export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="hero-gradient flex min-h-screen flex-col items-center justify-center gap-6"
    >
      <HakiLogo variant="colored" size={96} />
      <p className="font-logo text-2xl font-bold text-foreground">حكي</p>
      <p className="text-sm text-muted-foreground">
        منصة المحتوى الصوتي والرقمي
      </p>
    </motion.div>
  );
}
