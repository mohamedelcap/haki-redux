import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { HakiLogo, HakiLogoInline } from "@/components/HakiLogo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { usePlayer } from "@/lib/player";
import { cn } from "@/lib/utils";
import {
  CirclePlus as PublishIcon,
  Home as HomeIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Search as SearchIcon,
  Shield,
  Sparkles,
  Trophy as TrophyIcon,
  UserRound,
  UserRound as UserIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useEffect, useState } from "react";

export function Header() {
  const { t, lang, setLang } = useLang();
  const { isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { track } = usePlayer();
  const isAdmin =
    user?.role === "admin" || user?.role === "super_admin" || user?.role === "publisher" || user?.role === "author";

  const navItems = [
    { label: t("home"), href: "/" },
    { label: t("browse"), href: "/browse" },
    { label: t("live"), href: "/live" },
    { label: t("challenges"), href: "/challenges" },
    { label: t("subscriptions"), href: "/subscriptions" },
  ];

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  // Close mobile sheet on route change is handled by links onClick
  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        track && "top-0",
      )}
    >
      <div className="haki-container flex h-16 items-center gap-3">
          {/* Logo — right side in RTL (first in DOM) */}
        <Link to="/" className="flex shrink-0 items-center" aria-label="حكي — الصفحة الرئيسية">
          <HakiLogoInline size={38} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop search */}
        <form onSubmit={submitSearch} className="hidden md:block flex-1 max-w-sm mx-auto">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="ps-9 bg-muted/60 border-transparent focus-visible:bg-background"
              aria-label={t("search")}
            />
          </div>
        </form>

        <div className="flex-1 md:hidden" />

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* EN toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex h-9 px-2.5 font-bold text-xs"
            aria-label={lang === "ar" ? "التبديل إلى الإنجليزية" : "التبديل إلى العربية"}
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          >
            {lang === "ar" ? "EN" : "ع"}
          </Button>

          {/* Notifications */}
          <NotificationsBell />

          {/* Publish */}
          <Link to="/publish" className="hidden md:inline-flex">
            <Button size="sm" variant="outline" className="h-9 gap-1.5 font-semibold">
              <Sparkles className="size-3.5 text-primary" />
              {t("publish")}
            </Button>
          </Link>

          {/* Auth */}
          {isAuthenticated ? (
            <AccountMenu />
          ) : (
            <Link to="/auth">
              <Button size="sm" className="h-9 font-semibold">
                {t("signIn")}
              </Button>
            </Link>
          )}

          {/* Mobile icons */}
          <div className="flex items-center lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={t("search")}
              onClick={() => navigate("/search")}
            >
              <Search className="size-5" />
            </Button>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="القائمة">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <SheetHeader className="border-b p-4 text-start">
                  <SheetTitle className="flex items-center gap-2">
                    <HakiLogo variant="colored" size={32} hideWordmark />
                    <span className="font-logo text-xl font-bold">حكي</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col p-3" aria-label="Mobile">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div className="my-2 h-px bg-border" />
                  <Link
                    to="/publish"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    {t("publish")}
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    {t("myAccount")}
                  </Link>
                  {isAuthenticated && (
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted"
                    >
                      {t("myDashboard")}
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted"
                    >
                      لوحة الإدارة
                    </Link>
                  )}
                  {!isAuthenticated && (
                    <Link
                      to="/admin-login"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-muted"
                    >
                      دخول الإدارة
                    </Link>
                  )}
                  <div className="my-2 h-px bg-border" />
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2.5 text-start text-sm font-semibold hover:bg-muted"
                    onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                  >
                    {lang === "ar" ? "English" : "العربية"}
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function AccountMenu() {
  const { t } = useLang();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin =
    user?.role === "admin" || user?.role === "super_admin" || user?.role === "publisher" || user?.role === "author";

  return (
    <div className="flex items-center gap-1">
      {isAdmin && (
        <Link to="/admin" className="hidden lg:inline-flex">
          <Button variant="ghost" size="sm" className="h-9 gap-1.5">
            <Shield className="size-4" />
            لوحة الإدارة
          </Button>
        </Link>
      )}
      <Link to="/profile" aria-label={t("myAccount")} className="hidden sm:block">
        <Button variant="ghost" size="icon" className="rounded-full">
          {user?.image ? (
            <img src={user.image} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <UserRound className="size-5" />
          )}
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("signOut")}
        className="hidden sm:inline-flex"
        onClick={async () => {
          await signOut();
          navigate("/");
        }}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}

/** Mobile bottom navigation (app-like). */
export function MobileBottomNav() {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const { track } = usePlayer();
  const items = [
    { label: t("home"), href: "/", icon: HomeIcon },
    { label: t("search"), href: "/search", icon: SearchIcon },
    { label: t("challenges"), href: "/challenges", icon: TrophyIcon },
    { label: t("publish"), href: "/publish", icon: PublishIcon },
    {
      label: t("myAccount"),
      href: isAuthenticated ? "/profile" : "/auth?returnTo=%2Fprofile",
      icon: UserIcon,
    },
  ];

  return (
    <nav
      className={cn(
        "fixed inset-x-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden",
        track ? "bottom-[64px]" : "bottom-0",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <item.icon className="size-5" />
            <span className="line-clamp-1">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
