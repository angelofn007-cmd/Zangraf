'use client';

import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {Moon, Sun} from 'lucide-react';

const storageKey = 'zangraf-theme';
const ThemeContext = createContext({night: false, toggle: (_button: HTMLElement) => {}});

export function ThemeProvider({children}: {children: ReactNode}) {
  const [night, setNight] = useState(false);
  const changing = useRef(false);
  useEffect(() => {
    setNight(document.documentElement.dataset.theme === 'dark');
    function sync(event: StorageEvent) {
      if (event.key !== storageKey) return;
      const dark = event.newValue === 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      setNight(dark);
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  async function toggle(button: HTMLElement) {
    if (changing.current) return;
    const next = !night;
    const root = document.documentElement;
    const update = () => {
      root.dataset.theme = next ? 'dark' : 'light';
      flushSync(() => setNight(next));
      try { localStorage.setItem(storageKey, next ? 'dark' : 'light'); } catch {}
    };
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update();
      return;
    }
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    changing.current = true;
    root.classList.add('zg-theme-changing');
    const transition = document.startViewTransition(update);
    try {
      await transition.ready;
      await root.animate({clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]}, {
        duration: 720, easing: 'cubic-bezier(.22,.68,0,1)', fill: 'forwards', pseudoElement: '::view-transition-new(root)',
      }).finished;
    } catch {
      // An interrupted transition must still leave the requested theme applied.
      update();
    } finally {
      await transition.finished.catch(() => {});
      root.classList.remove('zg-theme-changing');
      changing.current = false;
    }
  }
  return <ThemeContext.Provider value={{night, toggle}}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
export function ThemeToggle({className = ''}: {className?: string}) {
  const {night, toggle} = useTheme();
  const label = night ? 'Ativar modo claro' : 'Ativar modo noturno';
  return <button type="button" className={`zg-theme-toggle ${className}`} aria-label={label} title={label} aria-pressed={night} onClick={event => void toggle(event.currentTarget)}>
    {night ? <Sun size={20} strokeWidth={1.7}/> : <Moon size={20} strokeWidth={1.7}/>}
  </button>;
}
