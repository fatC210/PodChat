import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Plus, Phone } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
}

interface FloatingChatProps {
  open: boolean;
  onClose: () => void;
}

function StreamingText({ text, onDone }: { text: string; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idx = useRef(0);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    idx.current = 0;
    setDisplayed('');
    setDone(false);

    const iv = setInterval(() => {
      idx.current += 1;
      setDisplayed(text.slice(0, idx.current));

      if (idx.current >= text.length) {
        clearInterval(iv);
        setDone(true);
        onDoneRef.current?.();
      }
    }, 25);

    return () => clearInterval(iv);
  }, [text]);

  return <>{displayed}{!done && <span className="inline-block w-[2px] h-[12px] bg-foreground/60 ml-0.5 animate-pulse align-middle" />}</>;
}

export default function FloatingChat({ open, onClose }: FloatingChatProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'ai', text: "Hey! You were just listening to the part about AI creativity. Got any questions? 🎙️", streaming: true },
  ]);
  const [input, setInput] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Call timer
  useEffect(() => {
    if (!open) return;
    setElapsed(0);
    const iv = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(iv);
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, waiting]);

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const markDone = useCallback((id: string) => {
    setMessages(p => p.map(m => m.id === id ? { ...m, streaming: false } : m));
  }, []);

  const send = useCallback(() => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input, streaming: false };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setWaiting(true);

    // Simulate AI response after user message finishes streaming
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(), role: 'ai',
        text: "Great question! In the episode, I argued that creativity isn't about generating something from nothing — it's about making unexpected connections.",
        streaming: true,
      };
      setMessages(p => [...p, aiMsg]);
      setWaiting(false);
    }, 1200);
  }, [input]);

  const newSession = useCallback(() => {
    setMessages([
      { id: Date.now().toString(), role: 'ai', text: "Hey! You were just listening to the part about AI creativity. Got any questions? 🎙️", streaming: true },
    ]);
    setElapsed(0);
  }, []);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed bottom-4 right-4 z-50 w-[340px] sm:w-[380px] h-[480px] flex flex-col rounded-2xl bg-card border border-accent/40 shadow-2xl shadow-accent/10 overflow-hidden animate-scale-in">
      {/* Header - live call style */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-accent/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-[9px] font-bold text-accent">AC</span>
            </div>
            {/* Live ring animation */}
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent animate-ping" />
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-foreground leading-tight">{t('chat.title')}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-accent font-medium">{t('chat.live')}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{fmt(elapsed)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={newSession} className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center" title={t('chat.newSession')}>
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center" title={t('chat.endChat')}>
            <Phone className="h-3.5 w-3.5 rotate-[135deg]" />
          </button>
        </div>
      </div>

      {/* Soundwave bar */}
      <div className="flex items-center justify-center gap-[2px] h-5 bg-accent/5 shrink-0">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="w-[2px] rounded-full bg-accent/40"
            style={{
              height: `${4 + Math.random() * 8}px`,
              animation: `pulse ${0.6 + Math.random() * 0.8}s ease-in-out infinite`,
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {m.role === 'ai' && (
              <div className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold bg-accent/15 border border-accent/30 text-accent">
                AC
              </div>
            )}
            <div className={`max-w-[78%] px-3 py-2 text-[12px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-accent text-accent-foreground rounded-2xl rounded-br-sm'
                : 'bg-secondary text-foreground rounded-2xl rounded-bl-sm'
            }`}>
              {m.streaming ? <StreamingText text={m.text} onDone={() => markDone(m.id)} /> : m.text}
            </div>
          </div>
        ))}
        {waiting && (
          <div className="flex items-start gap-2">
            <div className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold bg-accent/15 border border-accent text-accent">
              AC
            </div>
            <div className="bg-secondary rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-[3px]">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-border shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={t('chat.placeholder')}
            className="flex-1 h-8 px-3 rounded-full bg-secondary text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-20 hover:opacity-90 transition-opacity shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
