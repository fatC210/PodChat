import { useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mic, Send, PhoneOff } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export default function ChatPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'ai', text: "Hey! You were just listening to the part about AI creativity. Got any questions? 🎙️" },
  ]);
  const [input, setInput] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const send = () => {
    if (!input.trim()) return;
    setMessages(p => [...p, { id: Date.now().toString(), role: 'user', text: input }]);
    setInput('');
    setSpeaking(true);
    setTimeout(() => {
      setMessages(p => [...p, {
        id: (Date.now() + 1).toString(), role: 'ai',
        text: "Great question! In the episode, I argued that creativity isn't about generating something from nothing — it's about making unexpected connections. AI does this through pattern recognition at scale, while humans do it through lived experience.",
      }]);
      setSpeaking(false);
    }, 1800);
  };

  return (
    <div className="max-w-xl mx-auto px-4 flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between py-3">
        <Link to={`/podcast/${id}/listen`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← {t('chat.backToListen')}
        </Link>
        <span className="font-mono text-[11px] text-muted-foreground">{fmt(elapsed)}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2 pt-2">
        {messages.map((m, i) => (
          <div key={m.id} className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}
            style={{ animationDelay: `${i * 50}ms` }}>
            {/* Avatar */}
            {m.role === 'ai' && (
              <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border transition-colors ${
                speaking && i === messages.length - 1 ? 'bg-accent/15 border-accent text-accent' : 'bg-card border-border text-foreground'
              }`}>
                AC
              </div>
            )}
            {/* Bubble */}
            <div className={`max-w-[75%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-accent text-accent-foreground rounded-2xl rounded-br-md'
                : 'bg-card border border-border text-foreground rounded-2xl rounded-bl-md'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {speaking && (
          <div className="flex items-end gap-2 animate-fade-in">
            <div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold bg-accent/15 border border-accent text-accent">
              AC
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-[3px]">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="py-3 border-t border-border space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onMouseDown={() => setRecording(true)}
            onMouseUp={() => setRecording(false)}
            onMouseLeave={() => setRecording(false)}
            className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              recording ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>
          <div className="flex-1 relative">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={t('chat.placeholder')}
              className="w-full h-9 pl-3 pr-9 rounded-full bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
            <button onClick={send} disabled={!input.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-20 hover:opacity-90 transition-opacity">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] text-muted-foreground">{t('chat.holdToSpeak')} · {t('chat.orType')}</p>
          <Link to={`/podcast/${id}/listen`}
            className="inline-flex items-center gap-1 text-[11px] text-destructive font-medium hover:underline">
            <PhoneOff className="h-3 w-3" /> {t('chat.endChat')}
          </Link>
        </div>
      </div>
    </div>
  );
}
