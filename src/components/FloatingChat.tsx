import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

interface FloatingChatProps {
  open: boolean;
  onClose: () => void;
}

export default function FloatingChat({ open, onClose }: FloatingChatProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'ai', text: "Hey! You were just listening to the part about AI creativity. Got any questions? 🎙️" },
  ]);
  const [input, setInput] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useCallback(() => {
    if (!input.trim()) return;
    setMessages(p => [...p, { id: Date.now().toString(), role: 'user', text: input }]);
    setInput('');
    setSpeaking(true);
    setTimeout(() => {
      setMessages(p => [...p, {
        id: (Date.now() + 1).toString(), role: 'ai',
        text: "Great question! In the episode, I argued that creativity isn't about generating something from nothing — it's about making unexpected connections.",
      }]);
      setSpeaking(false);
    }, 1800);
  }, [input]);

  const newSession = useCallback(() => {
    setMessages([
      { id: Date.now().toString(), role: 'ai', text: "Hey! You were just listening to the part about AI creativity. Got any questions? 🎙️" },
    ]);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[340px] sm:w-[380px] h-[480px] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-accent">AC</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{t('chat.title')}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={newSession} className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center" title={t('chat.newSession')}>
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
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
              {m.text}
            </div>
          </div>
        ))}
        {speaking && (
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
  );
}
