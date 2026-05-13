# 21st-magic snippets — Toast + Command Palette (2026-05-13 batch)

## Toast notification system

**Source:** 21st `Toaster` component con `sonner` lib + framer-motion.

**Key API:**
```tsx
const toasterRef = useRef<ToasterRef>(null);
toasterRef.current?.show({
  title: 'Cotización Completada',
  message: 'Folio #2378845 generado',
  variant: 'success' | 'error' | 'warning' | 'default',
  duration: 4000,
  position: 'top-right',
  actions: { label: 'Ver', onClick: () => router.push(...), variant: 'outline' },
  onDismiss: () => {},
  highlightTitle: true,
});
```

**Stack obligatorio:**
- `sonner` lib (`npm install sonner`)
- `framer-motion` (ya instalado) para `motion.div` con variants `initial/animate/exit`
- `lucide-react` para icons CheckCircle/AlertCircle/Info/AlertTriangle/X

**Animation pattern:**
```tsx
const toastAnimation = {
  initial: { opacity: 0, y: 50, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 50, scale: 0.95 },
};
// transition: { duration: 0.3, ease: 'easeOut' }
```

**LUMINA adaptation:**
- variantStyles success: `bg-white border-emerald-500/50 border-l-4`
- variantStyles error: `bg-white border-rose-500/50 border-l-4`
- variantStyles warning: `bg-white border-amber-500/50 border-l-4`
- variantStyles default: `bg-white border-slate-200 border-l-4 border-l-indigo-500`
- Rounded: `rounded-2xl` (NO `rounded-md` del snippet original)
- Shadow: `shadow-xl shadow-slate-900/10`
- Min-width: `min-w-[320px] max-w-[400px]`
- Title color: `text-{color}-700` / `text-slate-900` por variant
- Action button: pill rounded-full + LUMINA gradient para primary

**Position default:** `top-right` (no bottom para no chocar con Aria floating button).

## Command Palette

**Source:** 21st (saved a `C:\Users\hjtm\.claude\projects\C--dev-cotizador-telcel\<session>\tool-results\mcp-21st-magic-21st_magic_component_inspiration-1778713354185.txt`, 125KB — leer en chunks).

**Stack recomendado:**
- `cmdk` lib (`npm install cmdk`) — estándar industria pacocoursey
- `framer-motion` para overlay + items animations
- `lucide-react` para icons

**Pattern key API:**
```tsx
<Command.Dialog open={open} onOpenChange={setOpen}>
  <Command.Input placeholder="Buscar acción..." />
  <Command.List>
    <Command.Empty>No encontrado.</Command.Empty>
    <Command.Group heading="Acciones">
      <Command.Item onSelect={() => action()}>...</Command.Item>
    </Command.Group>
    <Command.Group heading="Páginas">...</Command.Group>
    <Command.Group heading="Clientes">...</Command.Group>
  </Command.List>
</Command.Dialog>
```

**Keyboard shortcut:**
```tsx
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      setOpen(o => !o);
    }
  };
  document.addEventListener('keydown', down);
  return () => document.removeEventListener('keydown', down);
}, []);
```

**LUMINA adaptation:**
- Overlay: `fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm`
- Dialog content: `max-w-2xl bg-white rounded-2xl shadow-2xl shadow-indigo-200/50 border border-slate-200`
- Input: `text-lg p-4 border-b border-slate-200 placeholder-slate-400`
- Group heading: `text-xs uppercase tracking-widest text-slate-500 px-4 py-2`
- Item idle: `px-4 py-2 hover:bg-indigo-50 cursor-pointer flex items-center gap-3`
- Item selected (`data-[selected=true]`): `bg-indigo-50 border-l-2 border-indigo-500 text-indigo-700`
- Icon left: lucide w-5 h-5 text-slate-500 (selected: text-indigo-500)
- Shortcut hint right: kbd `text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded`

**Sections recomendadas:**
- "ACCIONES" — Nueva cotización, Subir Excel, Logout
- "PÁGINAS" — todas las rutas /dashboard/*
- "CLIENTES" (debounce 200ms search /api/clientes)
- "COTIZACIONES RECIENTES" — top 10 últimas
- "CATÁLOGO" (planes + equipos)

**Shortcut conflict resolution:**
- Aria Copilot usa `⌘K` → Command Palette usa `⌘P` para evitar conflict.
- (Si quieres un solo shortcut: Aria es ⌘K abre asistente, ⌘P abre search. Coexisten.)
