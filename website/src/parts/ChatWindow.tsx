import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUp, Mic, Plus, RotateCcw, X } from 'lucide-react';
import { Button } from '../../../src/components/arc/button/button';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { useSite } from './useSite';
import './chat.css';

export type Chip = { key: string; mark: ReactNode; label: string; sub?: string };
type Message = { id: number; role: 'user' | 'ai'; text: string; chips?: Chip[] };

// A generic AI conversation with a composer that receives references as
// chips above the input, the way AI apps show attachments and context.
export function ChatWindow({ head, hello, chips, placeholder, ask, reply, onRemove, onSent, onReset, resetToken, canReset, drop, onPaste, className = '' }: {
  head: ReactNode; hello: ReactNode; chips: Chip[]; placeholder: string; ask: string;
  reply: (labels: string[]) => string; onRemove: (key: string) => void; onSent: () => void;
  onReset: () => void; resetToken: number; canReset: boolean;
  drop?: { accepts: (event: DragEvent) => boolean; onDrop: (event: DragEvent) => void; label: string };
  onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void; className?: string;
}) {
  const { copy } = useSite();
  const reduced = useReducedMotion();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [over, setOver] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => { window.clearTimeout(timer.current); setMessages([]); setDraft(''); setThinking(false); }, [resetToken]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const spring = reduced ? { duration: 0 } : motionTokens.spring.smooth;
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!chips.length || thinking) return;
    const sent = chips, labels = chips.map(chip => chip.label);
    setMessages(current => [...current, { id: Date.now(), role: 'user', text: draft.trim() || ask, chips: sent }]);
    setDraft(''); setThinking(true); onSent();
    timer.current = window.setTimeout(() => { setThinking(false); setMessages(current => [...current, { id: Date.now() + 1, role: 'ai', text: reply(labels) }]); }, 1100);
  };
  return <div className={`chat ${className}`}>
    <header className="chat-head">
      <span className="chat-title">{head}</span>
      <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={!canReset && !messages.length} data-tooltip={copy.demo.reset} aria-label={copy.demo.reset}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
    </header>
    <div className="chat-thread" aria-live="polite">
      {!messages.length && !thinking && <div className="chat-hello">{hello}</div>}
      <AnimatePresence initial={false}>
        {messages.map(message => <motion.div key={message.id} className={`bubble-row ${message.role}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          {message.chips && <div className="bubble-refs">{message.chips.map(chip => <span key={chip.key} className="chat-chip sent">{chip.mark}<span>{chip.label}</span></span>)}</div>}
          <p className="bubble">{message.text}</p>
        </motion.div>)}
        {thinking && <motion.div key="thinking" className="bubble-row ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><p className="bubble typing" aria-label="…"><i /><i /><i /></p></motion.div>}
      </AnimatePresence>
    </div>
    <form className="composer" data-over={over || undefined} onSubmit={send}
      onDragEnter={event => { if (drop?.accepts(event)) { event.preventDefault(); setOver(true); } }}
      onDragOver={event => { if (drop?.accepts(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false); }}
      onDrop={event => { setOver(false); if (drop?.accepts(event)) { event.preventDefault(); drop.onDrop(event); } }}>
      <AnimatePresence initial={false}>
        {chips.length > 0 && <motion.div className="composer-chips" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
          <div className="composer-chips-inner">
            <AnimatePresence initial={false} mode="popLayout">
              {chips.map(chip => <motion.span key={chip.key} layout={!reduced} className="chat-chip" initial={{ opacity: 0, scale: .8, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .8 }} transition={spring}>
                <span className="chat-chip-mark">{chip.mark}</span>
                <span className="chat-chip-label">{chip.sub && <small>{chip.sub}</small>}{chip.label}</span>
                <button type="button" className="chat-chip-remove" aria-label={`${copy.demo.remove} ${chip.label}`} onClick={() => onRemove(chip.key)}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
              </motion.span>)}
            </AnimatePresence>
          </div>
        </motion.div>}
      </AnimatePresence>
      <input className="composer-input" value={draft} onChange={event => setDraft(event.target.value)} onPaste={onPaste} placeholder={chips.length ? ask : placeholder} aria-label={placeholder} />
      <div className="composer-row">
        <span className="composer-tool" aria-hidden="true"><Plus size={20} strokeWidth={1.5} /></span>
        <span className="composer-spacer" />
        <span className="composer-tool quiet" aria-hidden="true"><Mic size={18} strokeWidth={1.5} /></span>
        <Button type="submit" variant="primary" size="sm" className="composer-send" disabled={!chips.length || thinking} aria-label={copy.demo.send}><ArrowUp size={18} strokeWidth={2} aria-hidden="true" /></Button>
      </div>
      <AnimatePresence>{over && drop && <motion.div className="composer-drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{drop.label}</motion.div>}</AnimatePresence>
    </form>
  </div>;
}
