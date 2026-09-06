import { type ReactNode } from "react";
import { AlertCircle, Check, LoaderCircle, Search, X } from "lucide-react";
import { useState } from "react";
import { requestUploadUrl } from "@workspace/api-client-react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div><p className="mb-1 text-xs font-bold tracking-[.12em] text-accent">{eyebrow}</p><h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>{description && <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>}</div>
    {action && <div className="shrink-0">{action}</div>}
  </div>;
}
export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = { primary: "bg-primary text-primary-foreground shadow-sm hover:opacity-90", secondary: "bg-secondary text-secondary-foreground hover:brightness-95", ghost: "border border-border bg-card text-foreground hover:bg-muted", danger: "bg-destructive text-destructive-foreground hover:opacity-90" };
  return <button {...props} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}>{children}</button>;
}
export function Input({ label, icon, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; icon?: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-foreground/75">{label}</span><span className="relative block">{icon && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}<input {...props} className={`min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus:border-secondary focus:ring-4 focus:ring-secondary/15 ${icon ? "pr-10" : ""} ${className}`} /></span></label>;
}
export function Select({ label, children, className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-foreground/75">{label}</span><select {...props} className={`min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/15 ${className}`}>{children}</select></label>;
}
export function Textarea({ label, className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-foreground/75">{label}</span><textarea {...props} className={`min-h-24 w-full resize-y rounded-xl border border-input bg-card px-3 py-3 text-sm outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/15 ${className}`}/></label>;
}
export function SearchBox({ value, onChange, placeholder = "ابحث بالاسم أو الرقم..." }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17}/><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid="input-search" className="min-h-11 w-full rounded-xl border border-input bg-card pr-10 pl-10 text-sm outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/15"/>{value && <button onClick={() => onChange("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="button-clear-search"><X size={15}/></button>}</div>;
}
export function Money({ value, className = "", sign = true }: { value?: number | null; className?: string; sign?: boolean }) {
  return <span className={`tabular-nums ${className}`} dir="ltr">{sign ? "₪" : ""}{Math.abs(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}
export function Status({ value }: { value?: string | null }) {
  const v = (value || "").toLowerCase();
  const map: Record<string, [string, string]> = { pending: ["قيد الانتظار", "bg-secondary/20 text-primary"], processing: ["قيد التنفيذ", "bg-primary/10 text-primary"], ordered: ["تم الطلب", "bg-primary/10 text-primary"], arrived: ["وصل", "bg-emerald-100 text-emerald-800"], delivered: ["تم التسليم", "bg-emerald-100 text-emerald-800"], in_transit: ["في الطريق", "bg-amber-100 text-amber-800"], missing: ["ناقص", "bg-red-100 text-red-800"], paid: ["مدفوع", "bg-emerald-100 text-emerald-800"], partially_paid: ["مدفوع جزئياً", "bg-amber-100 text-amber-800"], cancelled: ["ملغى", "bg-red-100 text-red-800"] };
  const [label, cls] = map[v] || [value || "غير محدد", "bg-muted text-muted-foreground"];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`} data-testid={`status-${v || "unknown"}`}>{label}</span>;
}
export function LoadingRows({ cols = 4 }: { cols?: number }) { return <div className="space-y-3 p-4" data-testid="state-loading">{[1,2,3,4].map((i) => <div key={i} className="flex gap-3">{Array.from({length: cols}).map((_, j) => <div key={j} className="h-12 flex-1 animate-pulse rounded-lg bg-muted"/>)}</div>)}</div>; }
export function ErrorState({ onRetry }: { onRetry?: () => void }) { return <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-14 text-center" data-testid="state-error"><AlertCircle className="mb-3 text-destructive" size={28}/><h3 className="font-bold">تعذر تحميل البيانات</h3><p className="mt-1 text-sm text-muted-foreground">تحقق من الاتصال وحاول مرة أخرى.</p>{onRetry && <Button onClick={onRetry} variant="danger" className="mt-5">إعادة المحاولة</Button>}</div>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center" data-testid="state-empty"><div className="mb-4 grid size-12 place-items-center rounded-2xl bg-secondary/20 text-primary"><Check size={21}/></div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>; }
export function QueryState({ isLoading, isError, onRetry, children }: { isLoading?: boolean; isError?: boolean; onRetry?: () => void; children?: ReactNode }) { if (isLoading) return <LoadingRows/>; if (isError) return <ErrorState onRetry={onRetry}/>; return <>{children}</>; }
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) { if (!open) return null; return <div className="fixed inset-0 z-50 grid place-items-center bg-primary/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="modal"><div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-center justify-between"><h3 className="font-display text-xl font-bold">{title}</h3><button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" data-testid="button-close-modal"><X size={18}/></button></div>{children}</div></div>; }
export function Toast({ message, type = "success" }: { message: string; type?: "success" | "error" }) { return <div className={`fixed bottom-5 left-5 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-xl ${type === "success" ? "bg-primary" : "bg-destructive"}`} data-testid="status-toast">{type === "success" ? <Check size={16}/> : <AlertCircle size={16}/>}<span>{message}</span></div>; }
export function PageSkeleton() { return <div className="space-y-6 animate-pulse"><div className="h-10 w-52 rounded-xl bg-muted"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted"/>)}</div><div className="h-72 rounded-2xl bg-muted"/></div>; }
export function Spinner() { return <LoaderCircle className="animate-spin" size={17}/>; }
export function UploadField({ label = "ملف أو صورة", value, onChange, accept = "image/*" }: { label?: string; value?: string; onChange: (path: string) => void; accept?: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState("");
  const upload = async (file: File) => {
    setStatus("uploading"); setMessage("");
    try {
      const result = await requestUploadUrl({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" });
      const token = localStorage.getItem("elan_session_token");
      const response = await fetch(result.uploadURL, { method: "PUT", body: file, credentials: "include", headers: { "Content-Type": file.type || "application/octet-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!response.ok) throw new Error(`upload failed: ${response.status}`);
      onChange(result.objectPath); setStatus("idle"); setMessage("تم رفع الملف");
    } catch {
      setStatus("error"); setMessage("تعذر رفع الملف، حاول مرة أخرى");
    }
  };
  return <label className="block"><span className="mb-2 block text-xs font-bold text-foreground/75">{label}</span><span className="flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-input bg-card px-3 text-sm"><input type="file" accept={accept} className="min-w-0 flex-1 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-bold" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} disabled={status === "uploading"} />{status === "uploading" && <Spinner/>}{value && status !== "uploading" && <Check size={16} className="shrink-0 text-emerald-700"/>}</span>{message && <small className={`mt-1 block text-[11px] ${status === "error" ? "text-destructive" : "text-emerald-700"}`}>{message}</small>}</label>;
}