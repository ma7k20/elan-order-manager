import { useState, type FormEvent, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, MessageSquare, Send, Trash2, User, Cpu } from "lucide-react";
import {
  useGetAiSettings, useGetAiStatus, useUpdateAiSettings,
  useTestAiChat, useListGeminiConversations, useGetGeminiConversation,
  getGetAiSettingsQueryKey, getGetAiStatusQueryKey, getListGeminiConversationsQueryKey,
  getGetGeminiConversationQueryKey
} from "@workspace/api-client-react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, PageHeader, QueryState, Spinner, Status, Textarea, Toast } from "@/components/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fmtDate = (value?: string | null) => value ? new Date(value).toLocaleString("ar-IL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const safeArray = <T,>(value?: T[]) => value || [];

function StatCard({ label, value, sub, icon: Icon, tone = "primary" }: { label: string; value: React.ReactNode; sub?: string; icon: typeof Bot; tone?: "primary" | "gold" | "coral" | "mint" }) {
  const tones = { primary: "bg-primary text-primary-foreground", gold: "bg-secondary text-secondary-foreground", coral: "bg-accent text-accent-foreground", mint: "bg-[#dce9df] text-[#1d5945]" };
  return <div className={`animate-rise rounded-2xl p-5 shadow-sm ${tones[tone]}`}>
    <div className="mb-6 flex items-start justify-between"><span className="text-xs font-semibold opacity-75">{label}</span><span className="grid size-9 place-items-center rounded-xl bg-black/10"><Icon size={18}/></span></div>
    <div className="font-display text-2xl font-bold tabular-nums" dir="ltr">{value}</div>
    {sub && <p className="mt-1 text-[11px] opacity-70">{sub}</p>}
  </div>;
}

function SectionCard({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) { 
  return <section className={`rounded-2xl border border-card-border bg-card shadow-[0_8px_26px_rgba(32,60,61,.04)] ${className}`}><div className="flex items-center justify-between border-b border-border/70 px-5 py-4"><h3 className="font-display font-bold">{title}</h3>{action}</div>{children}</section>; 
}

function StatusAndSettings() {
  const qc = useQueryClient();
  const qStatus = useGetAiStatus({ query: { queryKey: getGetAiStatusQueryKey() } });
  const qSettings = useGetAiSettings({ query: { queryKey: getGetAiSettingsQueryKey() } });
  const updateSettings = useUpdateAiSettings();
  const [flash, setFlash] = useState("");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    updateSettings.mutate({
      data: {
        enabled: f.get("enabled") === "on",
        model: String(f.get("model")),
        systemPrompt: String(f.get("systemPrompt")),
        welcomeMessage: String(f.get("welcomeMessage")),
        humanHandoffMessage: String(f.get("humanHandoffMessage")),
        maxHistory: Number(f.get("maxHistory")),
        temperature: Number(f.get("temperature")),
        rateLimitPerMinute: Number(f.get("rateLimitPerMinute")),
      }
    }, {
      onSuccess: () => {
        setFlash("تم حفظ الإعدادات بنجاح");
        qc.invalidateQueries({ queryKey: getGetAiSettingsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetAiStatusQueryKey() });
        setTimeout(() => setFlash(""), 2600);
      }
    });
  };

  if (qStatus.isLoading || qSettings.isLoading) return <div className="py-12"><Spinner /></div>;
  if (qStatus.isError || qSettings.isError) return <QueryState isError onRetry={() => { qStatus.refetch(); qSettings.refetch(); }} />;

  const status = qStatus.data;
  const settings = qSettings.data;

  return <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="المحادثات النشطة" value={status?.conversationCount || 0} icon={MessageSquare} tone="primary" />
        <StatCard label="الرسائل المرسلة" value={status?.messageCount || 0} icon={Send} tone="mint" />
        <StatCard label="تحويلات للموظف" value={status?.handoffCount || 0} icon={User} tone="coral" />
        <StatCard label="حالة الربط" value={status?.geminiConnected ? "متصل" : "غير متصل"} icon={Cpu} tone={status?.geminiConnected ? "mint" : "coral"} sub={status?.whatsappConnected ? "واتساب متصل" : "واتساب غير متصل"} />
      </div>

      <SectionCard title="إعدادات المساعد الذكي">
        {settings && <form onSubmit={submit} className="space-y-5 p-5">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="size-4 accent-primary" /> تفعيل الرد الآلي
          </label>
          <Input name="model" label="نموذج الذكاء الاصطناعي (Model)" defaultValue={settings.model} required dir="ltr" />
          <Textarea name="systemPrompt" label="تعليمات النظام (System Prompt)" defaultValue={settings.systemPrompt} required rows={5} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Textarea name="welcomeMessage" label="رسالة الترحيب" defaultValue={settings.welcomeMessage} required rows={3} />
            <Textarea name="humanHandoffMessage" label="رسالة التحويل للموظف" defaultValue={settings.humanHandoffMessage} required rows={3} />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Input name="maxHistory" label="سجل المحادثة (Max History)" type="number" min="2" max="40" defaultValue={settings.maxHistory.toString()} required dir="ltr" />
            <Input name="temperature" label="مستوى الإبداع (Temperature)" type="number" step="0.1" min="0" max="2" defaultValue={settings.temperature.toString()} required dir="ltr" />
            <Input name="rateLimitPerMinute" label="الحد الأقصى بالدقيقة (Rate Limit)" type="number" min="1" max="120" defaultValue={settings.rateLimitPerMinute.toString()} required dir="ltr" />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={updateSettings.isPending}>{updateSettings.isPending && <Spinner />} حفظ الإعدادات</Button>
          </div>
        </form>}
      </SectionCard>
    </div>
    <aside className="space-y-6">
      <SectionCard title="حالة النظام">
        <div className="divide-y divide-border/70 p-4 text-sm">
          <div className="flex justify-between py-2"><span>اتصال Gemini</span> <span className={status?.geminiConnected ? "font-bold text-emerald-700" : "font-bold text-destructive"}>{status?.geminiConnected ? "نشط" : "مقطوع"}</span></div>
          <div className="flex justify-between py-2"><span>اتصال واتساب</span> <span className={status?.whatsappConnected ? "font-bold text-emerald-700" : "font-bold text-destructive"}>{status?.whatsappConnected ? "نشط" : "مقطوع"}</span></div>
          <div className="flex justify-between py-2"><span>إعداد الـ Webhook</span> <span className={status?.webhookConfigured ? "font-bold text-emerald-700" : "font-bold text-destructive"}>{status?.webhookConfigured ? "معدّ" : "غير معدّ"}</span></div>
          <div className="flex justify-between py-2"><span>آخر نشاط</span> <span className="text-muted-foreground" dir="ltr">{fmtDate(status?.lastMessageAt)}</span></div>
        </div>
      </SectionCard>
    </aside>
    {flash && <Toast message={flash} type="success" />}
  </div>;
}

function TestChat() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const chatMutation = useTestAiChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    
    chatMutation.mutate({
      data: {
        content: userMsg,
        conversationId: conversationId
      }
    }, {
      onSuccess: (data) => {
        if (!conversationId) setConversationId(data.conversationId);
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
        if (data.handoff) {
          setMessages(prev => [...prev, { role: "system", content: "⚠️ النظام: تم طلب التحويل لموظف بشري." }]);
        }
      },
      onError: () => {
        setMessages(prev => [...prev, { role: "system", content: "❌ خطأ في الاتصال بالمساعد الذكي." }]);
      }
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return <div className="mt-6 flex h-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <Bot size={20} />
        </div>
        <div>
          <h3 className="font-bold">محاكي المساعد الذكي</h3>
          <p className="text-xs text-muted-foreground">جرب إعدادات الذكاء الاصطناعي مباشرة</p>
        </div>
      </div>
      {messages.length > 0 && <Button variant="ghost" onClick={() => { setMessages([]); setConversationId(null); }} className="text-xs"><Trash2 size={14} className="ml-1"/> مسح المحادثة</Button>}
    </div>
    
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground opacity-60">
          <Bot size={48} className="mb-4 opacity-50" />
          <p className="font-bold">ابدأ المحادثة لاختبار المساعد الذكي</p>
          <p className="text-sm">سيتم استخدام الإعدادات الحالية للرد</p>
        </div>
      ) : (
        messages.map((msg, i) => (
          <div key={i} className={`flex w-full ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === "user" ? "bg-muted text-foreground rounded-tr-sm" : 
              msg.role === "system" ? "bg-destructive/10 text-destructive text-center mx-auto text-xs font-bold" :
              "bg-primary text-primary-foreground rounded-tl-sm"
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))
      )}
      {chatMutation.isPending && (
        <div className="flex w-full justify-end">
          <div className="max-w-[80%] rounded-2xl bg-primary/60 px-4 py-2 text-sm text-primary-foreground rounded-tl-sm">
            <span className="flex items-center gap-2"><Spinner /> يكتب...</span>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>

    <form onSubmit={sendMessage} className="border-t border-border/70 p-4 bg-background">
      <div className="flex gap-2">
        <Input 
          name="message" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="اكتب رسالتك هنا..." 
          className="flex-1" 
          autoComplete="off"
        />
        <Button type="submit" disabled={!input.trim() || chatMutation.isPending}><Send size={18} /></Button>
      </div>
    </form>
  </div>;
}

function InboxList() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const qList = useListGeminiConversations({ query: { queryKey: getListGeminiConversationsQueryKey() } });
  
  if (qList.isLoading) return <div className="py-12"><Spinner /></div>;
  if (qList.isError) return <QueryState isError onRetry={() => qList.refetch()} />;

  const convs = safeArray(qList.data);

  return <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
    <div className="flex flex-col h-[700px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border/70 px-4 py-3 bg-muted/30">
        <h3 className="font-bold">المحادثات</h3>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border/70">
        {convs.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">لا توجد محادثات</p> : 
          convs.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full flex flex-col text-right items-start p-4 transition-colors hover:bg-muted/40 ${selectedId === c.id ? "bg-muted/60" : ""}`}>
              <div className="flex w-full justify-between items-center mb-1">
                <span className="font-bold text-sm truncate">{c.title || c.phoneNumber || "محادثة مجهولة"}</span>
                <Status value={c.handoffStatus === "handed_off" ? "سلمت لموظف" : c.status} />
              </div>
              <span className="text-xs text-muted-foreground block truncate w-full" dir="ltr">{fmtDate(c.lastMessageAt || c.createdAt)}</span>
            </button>
          ))
        }
      </div>
    </div>
    
    <div className="flex flex-col h-[700px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {selectedId ? <ConversationDetail id={selectedId} /> : (
        <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
          <MessageSquare size={48} className="mb-4 opacity-20" />
          <p className="font-bold text-lg">اختر محادثة من القائمة</p>
          <p className="text-sm">لعرض التفاصيل وسجل الرسائل</p>
        </div>
      )}
    </div>
  </div>;
}

function ConversationDetail({ id }: { id: number }) {
  const qConv = useGetGeminiConversation(id, { query: { queryKey: getGetGeminiConversationQueryKey(id) } });
  
  if (qConv.isLoading) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (qConv.isError || !qConv.data) return <div className="flex h-full items-center justify-center"><QueryState isError onRetry={() => qConv.refetch()} /></div>;

  const conv = qConv.data;
  const messages = conv.messages || [];

  return <>
    <div className="border-b border-border/70 px-5 py-4 bg-muted/30 flex justify-between items-center">
      <div>
        <h3 className="font-bold text-lg">{conv.title || conv.phoneNumber}</h3>
        <p className="text-xs text-muted-foreground flex gap-3 mt-1">
          {conv.phoneNumber && <span dir="ltr">{conv.phoneNumber}</span>}
          <span>العميل: {conv.customerId || "غير مسجل"}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <Status value={conv.handoffStatus} />
        <Status value={conv.status} />
      </div>
    </div>
    
    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background/50">
      {messages.length === 0 ? <p className="text-center text-sm text-muted-foreground">لا توجد رسائل</p> : 
        messages.map((msg: any, i: number) => (
          <div key={i} className={`flex w-full ${msg.role === "user" ? "justify-start" : msg.role === "system" ? "justify-center" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === "user" ? "bg-muted text-foreground rounded-tr-sm" : 
              msg.role === "system" ? "bg-destructive/10 text-destructive text-xs font-bold" :
              "bg-primary text-primary-foreground rounded-tl-sm"
            }`}>
              {msg.role !== "system" && <span className="block text-[10px] opacity-60 mb-1">{msg.sender}</span>}
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <span className="block text-[10px] opacity-50 mt-1 text-left" dir="ltr">{fmtDate(msg.createdAt)}</span>
            </div>
          </div>
        ))
      }
    </div>
  </>;
}


export function AiAssistantPage() {
  return (
    <AppShell>
      <PageHeader 
        eyebrow="الذكاء الاصطناعي" 
        title="المساعد الذكي" 
        description="إدارة إعدادات المساعد الذكي، مراقبة حالته، واختبار المحادثات."
      />
      <Tabs defaultValue="status" className="mt-2 w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="status">الحالة والإعدادات</TabsTrigger>
          <TabsTrigger value="inbox">المحادثات</TabsTrigger>
          <TabsTrigger value="test">تجربة الذكاء الاصطناعي</TabsTrigger>
        </TabsList>
        <TabsContent value="status" className="focus-visible:outline-none">
          <StatusAndSettings />
        </TabsContent>
        <TabsContent value="inbox" className="focus-visible:outline-none">
          <InboxList />
        </TabsContent>
        <TabsContent value="test" className="focus-visible:outline-none">
          <TestChat />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
