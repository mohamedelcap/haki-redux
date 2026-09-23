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
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className={cn("flex-1", track && "pb-16")}>{<Outlet />}</main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
