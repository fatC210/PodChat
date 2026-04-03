import { useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mic, Send, PhoneOff, Volume2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'ai',
    text: "Hey! You were just listening to the part where we discussed whether AI can truly be creative. Got any questions about that? 🎙️",
    timestamp: '0:00',
  },
];

export default function ChatPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsedTime(p => p + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: formatTime(elapsedTime),
    };
    setMessages(p => [...p, userMsg]);
    setInput('');

    // Simulate AI response
    setIsSpeaking(true);
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: "Great question! In the episode, I argued that creativity isn't about generating something from nothing — it's about making unexpected connections between existing ideas. AI does this through pattern recognition at scale, while humans do it through lived experience and emotion. The key difference is intentionality — we create with purpose, while AI creates with probability.",
        timestamp: formatTime(elapsedTime + 3),
      };
      setMessages(p => [...p, aiMsg]);
      setIsSpeaking(false);
    }, 2000);
  };

  return (
    <div className="container max-w-2xl flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-border">
        <Link
          to={`/podcast/${id}/listen`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('chat.backToListen')}
        </Link>
        <span className="text-xs text-muted-foreground font-mono">{formatTime(elapsedTime)}</span>
      </div>

      {/* AI Host avatar */}
      <div className="flex flex-col items-center py-6">
        <div className={`relative h-20 w-20 rounded-2xl bg-card border-2 flex items-center justify-center transition-colors ${
          isSpeaking ? 'border-primary' : 'border-border'
        }`}>
          <span className="font-display text-2xl font-bold text-foreground">AC</span>
          {isSpeaking && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-4">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-0.5 bg-primary rounded-full animate-waveform"
                  style={{ animationDelay: `${i * 0.15}s`, height: '4px' }}
                />
              ))}
            </div>
          )}
        </div>
        <p className="font-display font-semibold text-foreground mt-3">Alex Chen</p>
        <p className="text-xs text-muted-foreground">AI Host</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-surface text-foreground rounded-bl-md'
            }`}>
              {msg.text}
              <div className={`text-[10px] mt-1 ${
                msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'
              }`}>
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="py-4 border-t border-border space-y-2">
        <div className="flex items-center gap-2">
          <button
            onMouseDown={() => setIsRecording(true)}
            onMouseUp={() => setIsRecording(false)}
            onMouseLeave={() => setIsRecording(false)}
            className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              isRecording
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover'
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={t('chat.placeholder')}
              className="w-full h-10 pl-4 pr-10 rounded-full bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            {t('chat.holdToSpeak')} · {t('chat.orType')}
          </p>
          <Link
            to={`/podcast/${id}/listen`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
          >
            <PhoneOff className="h-3 w-3" />
            {t('chat.endChat')}
          </Link>
        </div>
      </div>
    </div>
  );
}
