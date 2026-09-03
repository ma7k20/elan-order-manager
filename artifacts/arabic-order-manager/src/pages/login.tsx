import { useState, type FormEvent } from "react";
import { Redirect } from "wouter";
import { ShieldCheck } from "lucide-react";
import { useAppAuth } from "@/lib/auth";
import { Button, Input, Spinner } from "@/components/primitives";

export default function LoginPage() {
  const { account, login, loading } = useAppAuth();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && account) return <Redirect to="/dashboard" />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    setSubmitting(true);
    try {
      await login(String(form.get("phone")), String(form.get("pin")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تسجيل الدخول.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8" dir="rtl">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl shadow-primary/5">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck size={30}/></span>
          <h1 className="font-display text-3xl font-bold">الدخول إلى ELAN</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">أدخل رقم الهاتف ورمز PIN الخاص بحسابك.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input label="رقم الهاتف" name="phone" inputMode="tel" dir="ltr" placeholder="05XXXXXXXX" required />
          <Input label="رمز PIN" name="pin" type="password" inputMode="numeric" dir="ltr" minLength={4} maxLength={8} required />
          {message && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</p>}
          <Button className="w-full" type="submit" disabled={submitting || loading}>{submitting && <Spinner/>} تسجيل الدخول</Button>
        </form>
      </div>
    </div>
  );
}