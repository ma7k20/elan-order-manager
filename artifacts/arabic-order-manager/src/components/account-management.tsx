import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Plus, ShieldCheck, UserRound } from "lucide-react";
import { authApi, type AppAccount, useAppAuth } from "@/lib/auth";
import { Button, Input, Spinner } from "@/components/primitives";

export function AccountManagement() {
  const { account } = useAppAuth();
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  const loadAccounts = async () => {
    if (!account?.canManageAccounts) return;
    try {
      setAccounts(await authApi<AppAccount[]>("/auth/accounts"));
    } catch (requestError) {
      setError(true);
      setMessage(requestError instanceof Error ? requestError.message : "تعذر تحميل الحسابات.");
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, [account?.canManageAccounts]);

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSavingAccount(true);
    setMessage("");
    try {
      await authApi<AppAccount>("/auth/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: String(data.get("name")),
          phone: String(data.get("phone")),
          pin: String(data.get("pin")),
          canManageAccounts: data.get("canManageAccounts") === "on",
        }),
      });
      form.reset();
      setError(false);
      setMessage("تمت إضافة الحساب بنجاح.");
      await loadAccounts();
    } catch (requestError) {
      setError(true);
      setMessage(requestError instanceof Error ? requestError.message : "تعذر إضافة الحساب.");
    } finally {
      setSavingAccount(false);
    }
  };

  const changePin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSavingPin(true);
    setMessage("");
    try {
      await authApi<void>("/auth/pin", {
        method: "PATCH",
        body: JSON.stringify({
          currentPin: String(data.get("currentPin")),
          newPin: String(data.get("newPin")),
        }),
      });
      form.reset();
      setError(false);
      setMessage("تم تغيير رمز PIN.");
    } catch (requestError) {
      setError(true);
      setMessage(requestError instanceof Error ? requestError.message : "تعذر تغيير رمز PIN.");
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <>
      {message && <div className={`xl:col-span-2 rounded-xl px-4 py-3 text-sm ${error ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-800"}`}>{message}</div>}

      {account?.canManageAccounts && (
        <section className="rounded-2xl border border-card-border bg-card shadow-[0_8px_26px_rgba(32,60,61,.04)]">
          <div className="border-b border-border/70 px-5 py-4"><h3 className="flex items-center gap-2 font-display font-bold"><Plus size={18}/> إضافة حساب جديد</h3></div>
          <form onSubmit={createAccount} className="space-y-4 p-5">
            <Input label="اسم صاحب الحساب" name="name" required />
            <Input label="رقم الهاتف" name="phone" inputMode="tel" dir="ltr" placeholder="05XXXXXXXX" required />
            <Input label="رمز PIN مبدئي" name="pin" type="password" inputMode="numeric" dir="ltr" minLength={4} maxLength={8} required />
            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <input type="checkbox" name="canManageAccounts" className="size-4 accent-primary" />
              يستطيع إدارة وإضافة حسابات أخرى
            </label>
            <Button type="submit" disabled={savingAccount}>{savingAccount && <Spinner/>} إضافة الحساب</Button>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-card-border bg-card shadow-[0_8px_26px_rgba(32,60,61,.04)]">
        <div className="border-b border-border/70 px-5 py-4"><h3 className="flex items-center gap-2 font-display font-bold"><KeyRound size={18}/> تغيير رمز PIN</h3></div>
        <form onSubmit={changePin} className="space-y-4 p-5">
          <Input label="رمز PIN الحالي" name="currentPin" type="password" inputMode="numeric" dir="ltr" required />
          <Input label="رمز PIN الجديد" name="newPin" type="password" inputMode="numeric" dir="ltr" minLength={4} maxLength={8} required />
          <Button type="submit" disabled={savingPin}>{savingPin && <Spinner/>} حفظ PIN الجديد</Button>
        </form>
      </section>

      {account?.canManageAccounts && (
        <section className="xl:col-span-2 rounded-2xl border border-card-border bg-card shadow-[0_8px_26px_rgba(32,60,61,.04)]">
          <div className="border-b border-border/70 px-5 py-4"><h3 className="flex items-center gap-2 font-display font-bold"><UserRound size={18}/> الحسابات المصرح لها</h3></div>
          <div className="divide-y divide-border/70">
            {accounts.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div><p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground" dir="ltr">{item.phone}</p></div>
                <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${item.canManageAccounts ? "bg-secondary/30 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {item.canManageAccounts && <ShieldCheck size={13}/>}
                  {item.canManageAccounts ? "مدير حسابات" : "مستخدم"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}