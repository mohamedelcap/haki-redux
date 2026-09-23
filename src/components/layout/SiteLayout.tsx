import { Footer } from "./Footer";
import { Header, MobileBottomNav } from "./Header";
import { usePlayer } from "@/lib/player";
import { cn } from "@/lib/utils";
import { Outlet, useLocation } from "react-router";
import { useEffect } from "react";

export default function SiteLayout() {
  const { track } = usePlayer();
  const location = useLocation();

  useEffect(() => {
    // If a hash is present, scroll to the anchor element instead of the top.
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      // Wait a frame so the target page has rendered its DOM.
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [location.pathname, location.hash]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className={cn("flex-1", track && "pb-16")}>{<Outlet />}</main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
