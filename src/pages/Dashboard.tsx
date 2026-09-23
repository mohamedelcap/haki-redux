import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { BookOpen, Compass, History, LogOut, Mic, Trophy } from "lucide-react";
import { Link, useNavigate } from "react-router";

const LINKS = [
  { href: "/browse", label: "تصفح المكتبة", desc: "كتب صوتية وإلكترونية، دراما، بودكاست، ومجلات", icon: Compass },
  { href: "/library", label: "مكتبتي", desc: "قوائم القراءة والمحتوى المحفوظ", icon: BookOpen },
  { href: "/history", label: "سجل الاستماع", desc: "تابع من حيث توقفت", icon: History },
  { href: "/challenges", label: "التحديات", desc: "شارك واربح مكافآت", icon: Trophy },
  { href: "/publish", label: "انشر محتواك", desc: "للمؤلفين ودور النشر وصناع المحتوى", icon: Mic },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="hero-gradient min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">مساحة المسجَّلين — حكي</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              أهلًا بك{user?.name ? `، ${user.name}` : ""}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              كل ما تحب من المحتوى الصوتي والرقمي في مكان واحد.
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="size-4" />
            تسجيل الخروج
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((l) => (
            <Link key={l.href} to={l.href}>
              <Card className="h-full transition-all card-shadow hover:card-shadow-hover hover:-translate-y-0.5">
                <CardHeader className="pb-2">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <l.icon className="size-5" />
                  </div>
                  <CardTitle className="text-base font-bold">{l.label}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{l.desc}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
