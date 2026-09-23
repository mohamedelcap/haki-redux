import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  /** Accepted file types, e.g. "image/*" or ".mp3,.m4a,audio/mpeg,audio/mp4". */
  accept: string;
  label: string;
  /** Called with the Convex storage id of the uploaded file. */
  onUploaded: (storageId: string) => void;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  /** Max size in MB (default 50). */
  maxSizeMB?: number;
};

/**
 * Uploads a file to Convex storage via a short-lived upload URL and hands the
 * storage id to the caller, which then attaches it (cover/audio/avatar).
 */
export function FileUpload({
  accept,
  label,
  onUploaded,
  className,
  variant = "outline",
  maxSizeMB = 50,
}: Props) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handlePick = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`الحد الأقصى لحجم الملف ${maxSizeMB} ميجابايت`);
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("فشل رفع الملف إلى التخزين");
      const { storageId } = (await res.json()) as { storageId: string };
      onUploaded(storageId);
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر رفع الملف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handlePick(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant={variant}
        className={cn("gap-1.5", className)}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? "جارٍ الرفع…" : label}
      </Button>
    </>
  );
}
