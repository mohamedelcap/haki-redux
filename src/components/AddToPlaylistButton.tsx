import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import { Check, ListPlus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * "Add to playlist" button + picker dialog used on content detail pages.
 * Creates a new playlist inline or toggles membership in existing lists.
 */
export function AddToPlaylistButton({ contentId }: { contentId: string }) {
  const { lang, t } = useLang();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const lists = useQuery(
    api.playlists.listMine,
    open && isAuthenticated ? {} : "skip",
  );
  const containing = useQuery(
    api.playlists.containingLists,
    open && isAuthenticated ? { contentId: contentId as any } : "skip",
  );
  const addItem = useMutation(api.playlists.addItem);
  const createPl = useMutation(api.playlists.create);
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const toggle = async (plId: string, has: boolean) => {
    setBusy(true);
    try {
      if (has) {
        await api_playlists_removeItem(plId);
      } else {
        await addItem({ id: plId as any, contentId: contentId as any });
        toast.success(L("أُضيف إلى القائمة", "Added to playlist"));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Local helper to avoid a second hook when removing.
  async function api_playlists_removeItem(plId: string) {
    await removeItem({ id: plId as any, contentId: contentId as any });
    toast.success(L("أُزيل من القائمة", "Removed from playlist"));
  }
  const removeItem = useMutation(api.playlists.removeItem);

  const createAndAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const plId = await createPl({ name: newName });
      await addItem({ id: plId as any, contentId: contentId as any });
      toast.success(L("أُنشئت القائمة وأُضيف العمل", "Playlist created, work added"));
      setNewName("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="ghost">
          <ListPlus className="size-4" />
          {t("addToMyList")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{L("القوائم", "Playlists")}</DialogTitle>
          <DialogDescription>
            {L("أضف العمل إلى قائمة موجودة أو أنشئ قائمة جديدة.", "Add this work to an existing list or create a new one.")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {lists === undefined ? (
            <p className="py-4 text-center text-sm text-muted-foreground">...</p>
          ) : lists.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {L("لا قوائم بعد — أنشئ أول قائمة أدناه.", "No playlists yet — create your first one below.")}
            </p>
          ) : (
            lists.map((pl: any) => {
              const has = (containing ?? []).includes(pl._id);
              return (
                <button
                  key={pl._id}
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(pl._id, has)}
                  className="flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  <span className="truncate">{pl.name}</span>
                  {has ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="size-3.5" />
                      {L("مضاف", "In list")}
                    </span>
                  ) : (
                    <Plus className="size-4 text-muted-foreground" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex w-full items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={L("اسم قائمة جديدة...", "New playlist name...")}
              onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
            />
            <Button size="sm" disabled={busy || !newName.trim()} onClick={createAndAdd}>
              <Plus className="size-4" />
              {L("إنشاء", "Create")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
