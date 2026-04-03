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

      {/* Avatar */}
      <div className="flex flex-col items-center py-6 shrink-0">
        <div className={`relative h-16 w-16 rounded-2xl bg-card border-2 flex items-center justify-center transition-colors ${speaking ? 'border-accent' : 'border-border'}`}>
          <span className="text-xl font-bold text-foreground">AC</span>
          {speaking && (
            <div className="absolute -bottom-2 flex items-end gap-[3px] h-4">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="w-[2px] bg-accent rounded-full animate-bar" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          )}
        </div>
        <p className="text-sm font-semibold text-foreground mt-2">Alex Chen</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((m, i) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            style={{ animationDelay: `${i * 50}ms` }}>
            <div className={`max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-foreground text-background rounded-2xl rounded-br-md'
                : 'bg-card border border-border text-foreground rounded-2xl rounded-bl-md'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
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
