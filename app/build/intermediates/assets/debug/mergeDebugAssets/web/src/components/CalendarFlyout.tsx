import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { useClock } from '../lib/shell';
import { IconButton } from './Shared';

function dateKey(date: Date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
export function CalendarFlyout() {
  const now = useClock();
  const { closeFlyouts } = useDesktop();
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const dates = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - first + 1));
  const chooseDate = (date: Date, focus = false) => {
    setSelected(date);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    if (focus) requestAnimationFrame(() => dayRefs.current.get(dateKey(date))?.focus());
  };
  const changeMonth = (offset: number) => chooseDate(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  return <motion.aside className="calendar-panel calendar-flyout acrylic shell-panel" role="dialog" aria-label="Calendar" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} transition={{ duration: .2 }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <header><IconButton title="Close calendar" onClick={closeFlyouts}><X size={15} /></IconButton><time dateTime={now.toISOString()}>{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time><p>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p></header>
    <div className="calendar-month"><strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><div><IconButton title="Previous month" onClick={() => changeMonth(-1)}><ChevronUp size={17} /></IconButton><IconButton title="Next month" onClick={() => changeMonth(1)}><ChevronDown size={17} /></IconButton></div></div>
    <div className="calendar-grid" role="group" aria-label={month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}>
      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span className="calendar-day-label" key={day}>{day}</span>)}
      {dates.map(date => <button ref={node => { if (node) dayRefs.current.set(dateKey(date), node); else dayRefs.current.delete(dateKey(date)); }} className={`${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${dateKey(date) === dateKey(now) ? 'today' : ''} ${dateKey(date) === dateKey(selected) ? 'chosen' : ''}`} key={dateKey(date)} aria-label={date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} aria-current={dateKey(date) === dateKey(now) ? 'date' : undefined} aria-pressed={dateKey(date) === dateKey(selected)} tabIndex={dateKey(date) === dateKey(selected) ? 0 : -1} onClick={() => chooseDate(date)} onKeyDown={event => {
        const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (event.key in offsets) { event.preventDefault(); chooseDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsets[event.key]), true); }
        if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); chooseDate(new Date(date.getFullYear(), date.getMonth() + (event.key === 'PageUp' ? -1 : 1), 1), true); }
        if (event.key === 'Home') { event.preventDefault(); chooseDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()), true); }
      }}>{date.getDate()}</button>)}
    </div><footer><span>{selected.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span><button className="small-button" onClick={() => chooseDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))}>Today</button></footer>
  </motion.aside>;
}