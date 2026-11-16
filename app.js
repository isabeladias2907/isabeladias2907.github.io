/* Planeja — organizador de tarefas.
   Tudo roda no navegador; os dados ficam no localStorage deste computador.
   Seções: constantes · utilidades · armazenamento · automações · alertas ·
   recorrência · Google Agenda · .ics · renderização · editor · eventos. */
'use strict';

// ---------- Constantes ----------
const STORAGE_KEY = 'planeja:v1';

const COLORS = [
  { id: 'red', name: 'Vermelho', hex: '#e03131', gcal: '11' },
  { id: 'orange', name: 'Laranja', hex: '#f76707', gcal: '6' },
  { id: 'amber', name: 'Amarelo', hex: '#f2a900', gcal: '5' },
  { id: 'green', name: 'Verde', hex: '#2f9e44', gcal: '10' },
  { id: 'mint', name: 'Menta', hex: '#0ca678', gcal: '2' },
  { id: 'blue', name: 'Azul', hex: '#1c7ed6', gcal: '7' },
  { id: 'indigo', name: 'Índigo', hex: '#4263eb', gcal: '9' },
  { id: 'purple', name: 'Roxo', hex: '#7048e8', gcal: '3' },
  { id: 'pink', name: 'Rosa', hex: '#d6336c', gcal: '4' },
  { id: 'graphite', name: 'Grafite', hex: '#6b7280', gcal: '8' },
];

const PRIORITIES = {
  urgent: { label: 'Urgente', mark: '!!!', rank: 0 },
  high: { label: 'Alta', mark: '!!', rank: 1 },
  medium: { label: 'Média', mark: '!', rank: 2 },
  low: { label: 'Baixa', mark: '·', rank: 3 },
};

const RECUR_LABEL = { daily: ['dia', 'dias'], weekly: ['semana', 'semanas'], monthly: ['mês', 'meses'], yearly: ['ano', 'anos'] };

const REMINDER_OPTIONS = [
  { m: 0, label: 'Na hora' }, { m: 15, label: '15 min' }, { m: 60, label: '1 h' },
  { m: 180, label: '3 h' }, { m: 1440, label: '1 dia' }, { m: 2880, label: '2 dias' }, { m: 10080, label: '1 semana' },
];

const TRIGGERS = {
  completed: 'Quando uma tarefa for concluída',
  moved: 'Quando uma tarefa for movida para a coluna',
  dueSoon: 'Quando faltar pouco para o prazo (horas)',
  overdue: 'Quando o prazo vencer',
  created: 'Quando uma tarefa for criada',
};

const ACTIONS = {
  move: 'Mover para a coluna',
  color: 'Mudar a cor para',
  priority: 'Mudar a prioridade para',
  addTag: 'Adicionar a tag',
  removeTag: 'Remover a tag',
  complete: 'Marcar como concluída',
  checklistAll: 'Marcar todo o checklist',
  recur: 'Criar a próxima repetição',
  notify: 'Enviar alerta',
  syncGcal: 'Enviar ao Google Agenda',
};

const VIEW_TITLES = { board: 'Quadro', list: 'Prazos', calendar: 'Calendário', automations: 'Automações', settings: 'Ajustes' };

// ---------- Utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => ymd(new Date());
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const clone = (o) => JSON.parse(JSON.stringify(o));
const colorHex = (c) => (COLORS.find((x) => x.id === c)?.hex) || (c && c.startsWith('#') ? c : '');

function dueAt(task) {
  if (!task.due) return null;
  const d = parseYmd(task.due);
  if (task.time) { const [h, m] = task.time.split(':').map(Number); d.setHours(h, m, 0, 0); }
  else d.setHours(23, 59, 0, 0);
  return d;
}

const fmtDate = (s) => parseYmd(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
function fmtDue(task) {
  if (!task.due) return '';
  const t = todayStr();
  let label;
  if (task.due === t) label = 'Hoje';
  else if (task.due === addDays(t, 1)) label = 'Amanhã';
  else if (task.due === addDays(t, -1)) label = 'Ontem';
  else label = fmtDate(task.due);
  return task.time ? `${label}, ${task.time}` : label;
}

function dueState(task) {
  if (!task.due || task.done) return '';
  const now = Date.now(), at = dueAt(task).getTime();
  if (at < now) return 'overdue';
  if (task.due === todayStr()) return 'today';
  if (at - now < 48 * 3600e3) return 'soon';
  return '';
}

function humanMinutes(m) {
  if (m === 0) return 'na hora';
  if (m % 1440 === 0) return `${m / 1440} dia${m / 1440 > 1 ? 's' : ''} antes`;
  if (m % 60 === 0) return `${m / 60} h antes`;
  return `${m} min antes`;
}

function toast(msg, action) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => { action.run(); el.remove(); };
    el.append(b);
  }
  $('#toasts').append(el);
  setTimeout(() => el.remove(), action ? 7000 : 3800);
}

function confirmBox(text) {
  const dlg = $('#confirmDialog');
  $('#confirmText').textContent = text;
  dlg.showModal();
  return new Promise((res) => dlg.addEventListener('close', () => res(dlg.returnValue === 'yes'), { once: true }));
}

// ---------- Armazenamento ----------
function defaultState() {
  const t = todayStr();
  const tags = [
    { id: 'trabalho', name: 'Trabalho', color: '#1c7ed6' },
    { id: 'pessoal', name: 'Pessoal', color: '#2f9e44' },
    { id: 'cliente', name: 'Cliente', color: '#7048e8' },
    { id: 'financeiro', name: 'Financeiro', color: '#f76707' },
    { id: 'foco', name: 'Foco', color: '#d6336c' },
  ];
  const base = { notes: '', start: '', time: '', recur: { freq: 'none', interval: 1, until: '' }, checklist: [], reminders: [1440, 60], done: false, completedAt: null, gcal: null, ruleLog: {}, example: true };
  const mk = (o) => ({ ...clone(base), id: uid(), createdAt: Date.now(), ...o });
  return {
    version: 1,
    columns: [
      { id: 'todo', name: 'A fazer' },
      { id: 'doing', name: 'Em andamento' },
      { id: 'review', name: 'Em revisão' },
      { id: 'done', name: 'Concluído' },
    ],
    tags,
    tasks: [
      mk({ title: 'Exemplo: enviar relatório mensal', column: 'todo', priority: 'high', color: 'blue', tags: ['trabalho'], due: addDays(t, 2), time: '17:00', recur: { freq: 'monthly', interval: 1, until: '' }, checklist: [{ id: uid(), text: 'Puxar números do mês', done: true }, { id: uid(), text: 'Revisar gráficos', done: false }] }),
      mk({ title: 'Exemplo: pagar fatura do cartão', column: 'todo', priority: 'urgent', color: 'orange', tags: ['financeiro', 'pessoal'], due: addDays(t, -1), reminders: [1440] }),
      mk({ title: 'Exemplo: proposta para cliente', column: 'doing', priority: 'high', color: 'purple', tags: ['cliente'], start: addDays(t, -2), due: addDays(t, 5), time: '12:00' }),
      mk({ title: 'Exemplo: reunião semanal de alinhamento', column: 'todo', priority: 'medium', color: 'mint', tags: ['trabalho'], due: addDays(t, (8 - new Date().getDay()) % 7 || 7), time: '10:00', recur: { freq: 'weekly', interval: 1, until: '' }, reminders: [15] }),
      mk({ title: 'Exemplo: revisar contrato', column: 'review', priority: 'medium', color: 'indigo', tags: ['cliente', 'foco'], due: t, time: '18:00' }),
      mk({ title: 'Exemplo: academia', column: 'done', priority: 'low', color: 'green', tags: ['pessoal'], due: addDays(t, -1), done: true, completedAt: Date.now() - 86400e3 }),
    ],
    rules: [
      { id: uid(), name: 'Concluída vai para "Concluído"', enabled: true, trigger: { type: 'completed' }, filter: {}, actions: [{ type: 'move', value: 'done' }] },
      { id: uid(), name: 'Tarefas recorrentes geram a próxima', enabled: true, trigger: { type: 'completed' }, filter: {}, actions: [{ type: 'recur' }] },
      { id: uid(), name: 'Mover para "Concluído" conclui a tarefa', enabled: true, trigger: { type: 'moved', column: 'done' }, filter: {}, actions: [{ type: 'complete' }, { type: 'checklistAll' }] },
      { id: uid(), name: 'Prazo vencido vira urgente e vermelho', enabled: true, trigger: { type: 'overdue' }, filter: {}, actions: [{ type: 'priority', value: 'urgent' }, { type: 'color', value: 'red' }, { type: 'notify' }] },
      { id: uid(), name: 'Avisar 24 h antes do prazo', enabled: true, trigger: { type: 'dueSoon', hours: 24 }, filter: {}, actions: [{ type: 'notify' }] },
      { id: uid(), name: 'Em andamento ganha a tag Foco', enabled: false, trigger: { type: 'moved', column: 'doing' }, filter: {}, actions: [{ type: 'addTag', value: 'foco' }] },
    ],
    settings: { theme: 'auto', notifications: false, googleClientId: '', autoSync: false, eventMinutes: 30 },
    notified: {},
  };
}

let state;
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : defaultState();
  } catch { state = defaultState(); }
  const def = defaultState();
  state.settings = { ...def.settings, ...(state.settings || {}) };
  state.notified ||= {};
  state.rules ||= [];
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('Não foi possível salvar neste navegador. Exporte um backup em Ajustes.'); }
  }, 120);
}
const getTask = (id) => state.tasks.find((t) => t.id === id);
const doneColumn = () => state.columns[state.columns.length - 1]?.id;
const firstColumn = () => state.columns[0]?.id;

// ---------- Automações ----------
function ruleMatches(rule, task) {
  const f = rule.filter || {};
  if (f.tag && !task.tags.includes(f.tag)) return false;
  if (f.priority && task.priority !== f.priority) return false;
  return true;
}

// Dispara as regras de um gatilho. `depth` evita laços (ex.: mover → concluir → mover).
function fire(type, task, ctx = {}, depth = 0) {
  if (depth > 3 || !task) return;
  for (const rule of state.rules) {
    if (!rule.enabled || rule.trigger.type !== type) continue;
    if (type === 'moved' && rule.trigger.column !== ctx.column) continue;
    if (!ruleMatches(rule, task)) continue;
    for (const a of rule.actions) runAction(a, task, rule, depth);
  }
}

function runAction(a, task, rule, depth) {
  switch (a.type) {
    case 'move':
      if (a.value && task.column !== a.value && state.columns.some((c) => c.id === a.value)) {
        task.column = a.value;
        fire('moved', task, { column: a.value }, depth + 1);
      }
      break;
    case 'color': task.color = a.value || ''; break;
    case 'priority': if (a.value) task.priority = a.value; break;
    case 'addTag': if (a.value && !task.tags.includes(a.value)) task.tags.push(a.value); break;
    case 'removeTag': task.tags = task.tags.filter((x) => x !== a.value); break;
    case 'complete': if (!task.done) setDone(task, true, depth + 1); break;
    case 'checklistAll': task.checklist.forEach((c) => (c.done = true)); break;
    case 'recur': spawnNext(task); break;
    case 'notify': notify(task, rule.name); break;
    case 'syncGcal': if (gToken()) pushToGoogle(task, { quiet: true }); break;
  }
}

function setDone(task, done, depth = 0) {
  if (task.done === done) return;
  task.done = done;
  task.completedAt = done ? Date.now() : null;
  if (done) fire('completed', task, {}, depth);
  else if (task.column === doneColumn()) task.column = firstColumn();
}

function moveTask(task, column) {
  if (task.column === column) return;
  task.column = column;
  if (column !== doneColumn() && task.done) { task.done = false; task.completedAt = null; }
  fire('moved', task, { column });
}

// Gatilhos de tempo (vencida / prazo próximo): cada regra roda uma vez por prazo de cada tarefa.
function checkTimeRules() {
  let changed = false;
  const now = Date.now();
  for (const task of state.tasks) {
    if (task.done || !task.due) continue;
    const at = dueAt(task).getTime();
    for (const rule of state.rules) {
      if (!rule.enabled || !['overdue', 'dueSoon'].includes(rule.trigger.type) || !ruleMatches(rule, task)) continue;
      const hit = rule.trigger.type === 'overdue' ? now > at : now > at - (rule.trigger.hours || 24) * 3600e3 && now <= at;
      const key = `${rule.id}@${task.due}${task.time}`;
      if (hit && !task.ruleLog[key]) {
        task.ruleLog[key] = now;
        for (const a of rule.actions) runAction(a, task, rule, 0);
        changed = true;
      }
    }
  }
  return changed;
}

// ---------- Alertas ----------
function notify(task, reason) {
  const body = `${task.title} — prazo ${fmtDue(task) || 'sem data'}${reason ? ` (${reason})` : ''}`;
  if (state.settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification('Planeja: prazo chegando', { body, icon: 'icon.svg', tag: task.id });
      n.onclick = () => { window.focus(); openEditor(task.id); };
    } catch { /* alguns navegadores só permitem via service worker */ }
  }
  toast(body, { label: 'Abrir', run: () => openEditor(task.id) });
}

// Lembretes configurados em cada tarefa (minutos antes do prazo).
function checkReminders() {
  let changed = false;
  const now = Date.now();
  for (const task of state.tasks) {
    if (task.done || !task.due) continue;
    const at = dueAt(task).getTime();
    for (const m of task.reminders || []) {
      const key = `${task.id}@${task.due}${task.time}@${m}`;
      if (state.notified[key]) continue;
      if (now >= at - m * 60e3 && now < at + 3600e3) {
        state.notified[key] = now;
        notify(task, m ? `lembrete de ${humanMinutes(m)}` : 'chegou a hora');
        changed = true;
      } else if (now >= at + 3600e3) {
        state.notified[key] = now; // passou da janela: não avisar atrasado várias vezes
        changed = true;
      }
    }
  }
  return changed;
}

function alertItems() {
  return state.tasks
    .filter((t) => !t.done && t.due && ['overdue', 'today', 'soon'].includes(dueState(t)))
    .sort((a, b) => dueAt(a) - dueAt(b));
}

function renderAlerts() {
  const items = alertItems();
  const n = $('#bellCount');
  n.hidden = !items.length;
  n.textContent = items.length;
  $('#alertList').innerHTML = items.length
    ? items.map((t) => {
        const s = dueState(t);
        return `<div class="alert ${s === 'overdue' ? 'overdue' : 'soon'}" data-open="${t.id}">
          <b>${esc(t.title)}</b>
          <small>${s === 'overdue' ? 'Venceu' : 'Vence'} ${esc(fmtDue(t))} · ${esc(PRIORITIES[t.priority].label)}</small>
        </div>`;
      }).join('')
    : '<p class="help" style="padding:8px;color:var(--muted)">Nada vencido ou vencendo nas próximas 48 horas.</p>';
}

function tick() {
  const a = checkTimeRules();
  const b = checkReminders();
  if (a || b) { save(); render(); } else renderAlerts();
}

// ---------- Recorrência ----------
function nextDate(s, recur) {
  const d = parseYmd(s), n = Math.max(1, +recur.interval || 1);
  if (recur.freq === 'daily') d.setDate(d.getDate() + n);
  else if (recur.freq === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (recur.freq === 'monthly' || recur.freq === 'yearly') {
    const day = d.getDate();
    d.setDate(1);
    if (recur.freq === 'monthly') d.setMonth(d.getMonth() + n); else d.setFullYear(d.getFullYear() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return ymd(d);
}

function spawnNext(task) {
  if (!task.recur || task.recur.freq === 'none' || !task.due || task.nextSpawned) return;
  const due = nextDate(task.due, task.recur);
  if (task.recur.until && due > task.recur.until) return;
  const shift = task.start ? (parseYmd(due) - parseYmd(task.due)) / 86400e3 : 0;
  const next = {
    ...clone(task), id: uid(), due, start: task.start ? addDays(task.start, Math.round(shift)) : '',
    column: firstColumn(), done: false, completedAt: null, createdAt: Date.now(), ruleLog: {}, nextSpawned: false,
    checklist: task.checklist.map((c) => ({ ...c, id: uid(), done: false })),
    // No Google a série já é recorrente: a próxima ocorrência herda o vínculo sem criar evento novo.
    gcal: task.gcal ? { ...task.gcal, series: true } : null,
  };
  task.nextSpawned = true;
  state.tasks.push(next);
  toast(`Próxima repetição criada para ${fmtDate(due)}`);
}

// Ocorrências futuras previstas (só para exibir no calendário).
function projections(task, fromStr, toStr) {
  const out = [];
  if (task.done || !task.due || task.recur?.freq === 'none' || task.nextSpawned) return out;
  let d = task.due;
  for (let i = 0; i < 400; i++) {
    d = nextDate(d, task.recur);
    if (d > toStr || (task.recur.until && d > task.recur.until)) break;
    if (d >= fromStr) out.push(d);
  }
  return out;
}

// ---------- Google Agenda ----------
let gAuth = { token: null, exp: 0 };
let gEvents = []; // eventos do mês visível
let gisLoading;

function gToken() { return gAuth.token && Date.now() < gAuth.exp ? gAuth.token : null; }

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = res; s.onerror = () => { gisLoading = null; rej(new Error('Sem conexão com o Google.')); };
    document.head.append(s);
  });
  return gisLoading;
}

async function connectGoogle() {
  const clientId = state.settings.googleClientId.trim();
  if (!clientId) { toast('Cole o ID do cliente OAuth do Google em Ajustes primeiro.'); setView('settings'); return false; }
  try { await loadGis(); } catch (e) { toast(e.message); return false; }
  return new Promise((resolve) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (r) => {
        if (r.error) { toast('O Google recusou a conexão: ' + r.error); return resolve(false); }
        gAuth = { token: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
        try { sessionStorage.setItem('planeja:g', JSON.stringify(gAuth)); } catch {}
        toast('Google Agenda conectado');
        render();
        resolve(true);
      },
      error_callback: (e) => { toast('Conexão cancelada' + (e?.type ? ` (${e.type})` : '')); resolve(false); },
    });
    client.requestAccessToken();
  });
}

async function gFetch(path, opts = {}) {
  if (!gToken() && !(await connectGoogle())) throw new Error('Google Agenda não conectado.');
  const r = await fetch('https://www.googleapis.com/calendar/v3' + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + gToken(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (r.status === 401) { gAuth = { token: null, exp: 0 }; throw new Error('A sessão do Google expirou. Conecte de novo.'); }
  if (!r.ok) throw new Error(`Google respondeu ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.status === 204 ? null : r.json();
}

function rrule(recur) {
  if (!recur || recur.freq === 'none') return null;
  let s = `RRULE:FREQ=${recur.freq.toUpperCase()};INTERVAL=${Math.max(1, +recur.interval || 1)}`;
  if (recur.until) s += `;UNTIL=${recur.until.replace(/-/g, '')}T235959Z`;
  return s;
}

function eventBody(task) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let start, end;
  if (task.time) {
    const s = dueAt(task), e = new Date(s.getTime() + (state.settings.eventMinutes || 30) * 60e3);
    const iso = (d) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    start = { dateTime: iso(s), timeZone: tz }; end = { dateTime: iso(e), timeZone: tz };
  } else {
    start = { date: task.due }; end = { date: addDays(task.due, 1) };
  }
  const tags = task.tags.map((id) => state.tags.find((t) => t.id === id)?.name).filter(Boolean);
  const lines = [
    task.notes,
    `Prioridade: ${PRIORITIES[task.priority].label}`,
    tags.length ? `Tags: ${tags.join(', ')}` : '',
    task.checklist.length ? 'Checklist:\n' + task.checklist.map((c) => `${c.done ? '☑' : '☐'} ${c.text}`).join('\n') : '',
    'Criado pelo Planeja',
  ].filter(Boolean);
  const body = {
    summary: (task.done ? '✓ ' : '') + task.title,
    description: lines.join('\n\n'),
    start, end,
    reminders: { useDefault: false, overrides: (task.reminders || []).slice(0, 5).map((m) => ({ method: 'popup', minutes: m })) },
  };
  const c = COLORS.find((x) => x.id === task.color);
  if (c) body.colorId = c.gcal;
  const r = rrule(task.recur);
  if (r) body.recurrence = [r];
  return body;
}

async function pushToGoogle(task, { quiet } = {}) {
  if (!task.due) { if (!quiet) toast('Defina um prazo antes de enviar ao Google Agenda.'); return; }
  try {
    let ev;
    if (task.gcal?.id && !task.gcal.series) {
      ev = await gFetch(`/calendars/primary/events/${encodeURIComponent(task.gcal.id)}`, { method: 'PATCH', body: JSON.stringify(eventBody(task)) });
    } else if (task.gcal?.series) {
      if (!quiet) toast('Esta ocorrência faz parte de uma série que já está no Google Agenda.');
      return;
    } else {
      ev = await gFetch('/calendars/primary/events', { method: 'POST', body: JSON.stringify(eventBody(task)) });
    }
    task.gcal = { id: ev.id, link: ev.htmlLink, at: Date.now() };
    save();
    if (!quiet) toast('Enviado ao Google Agenda');
    if (dlgTaskId === task.id) renderGcalLine(task);
    if (view === 'calendar') loadGoogleMonth();
  } catch (e) { toast(e.message); }
}

async function loadGoogleMonth() {
  if (!gToken()) { gEvents = []; return; }
  const from = calStart(), to = addDays(from, 42);
  try {
    const q = new URLSearchParams({ timeMin: parseYmd(from).toISOString(), timeMax: parseYmd(to).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    const r = await gFetch('/calendars/primary/events?' + q);
    gEvents = (r.items || []).filter((e) => !(e.description || '').includes('Criado pelo Planeja')).map((e) => ({
      title: e.summary || '(sem título)',
      date: e.start.date || ymd(new Date(e.start.dateTime)),
      time: e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      link: e.htmlLink,
    }));
    if (view === 'calendar') renderView();
  } catch (e) { toast(e.message); }
}

// ---------- Exportar .ics (Google, Outlook, Apple) ----------
function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c); }
function buildIcs(tasks) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planeja//PT-BR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Planeja'];
  for (const t of tasks) {
    if (!t.due || t.gcal?.series) continue;
    const d = t.due.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${t.id}@planeja`, `DTSTAMP:${stamp}`, `SUMMARY:${icsEscape((t.done ? '✓ ' : '') + t.title)}`);
    if (t.time) {
      const s = dueAt(t), e = new Date(s.getTime() + (state.settings.eventMinutes || 30) * 60e3);
      const f = (x) => `${ymd(x).replace(/-/g, '')}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
      lines.push(`DTSTART:${f(s)}`, `DTEND:${f(e)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${addDays(t.due, 1).replace(/-/g, '')}`);
    }
    if (t.notes) lines.push(`DESCRIPTION:${icsEscape(t.notes)}`);
    const r = rrule(t.recur);
    if (r) lines.push(r);
    for (const m of t.reminders || []) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(t.title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Filtros ----------
const filters = { q: '', priority: '', tag: '', hideDone: false };
function visibleTasks() {
  const q = filters.q.toLowerCase();
  return state.tasks.filter((t) =>
    (!q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q)) &&
    (!filters.priority || t.priority === filters.priority) &&
    (!filters.tag || t.tags.includes(filters.tag)) &&
    (!filters.hideDone || !t.done));
}
const byDue = (a, b) => (a.due ? dueAt(a) : Infinity) - (b.due ? dueAt(b) : Infinity) || PRIORITIES[a.priority].rank - PRIORITIES[b.priority].rank;

// ---------- Renderização ----------
let view = 'board';
let calMonth = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

function setView(v) {
  view = v;
  try { localStorage.setItem('planeja:view', v); } catch {}
  if (v === 'calendar') loadGoogleMonth();
  render();
}

function render() {
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#viewTitle').textContent = VIEW_TITLES[view];
  renderSidebar();
  renderAlerts();
  renderFilterBar();
  renderView();
}

function renderSidebar() {
  $('#sideTags').innerHTML = state.tags.map((t) => {
    const n = state.tasks.filter((x) => x.tags.includes(t.id) && !x.done).length;
    return `<button class="side-tag ${filters.tag === t.id ? 'active' : ''}" data-tag="${t.id}"><span class="dot" style="background:${esc(t.color)}"></span>${esc(t.name)}<span class="count">${n}</span></button>`;
  }).join('');
  const open = state.tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => dueState(t) === 'overdue').length;
  $('#sideStats').innerHTML = `<span>${open.length} abertas · ${state.tasks.length - open.length} concluídas</span>${overdue ? `<span style="color:var(--danger);font-weight:600">${overdue} com prazo vencido</span>` : ''}<span>${gToken() ? '● Google Agenda conectado' : '○ Google Agenda desconectado'}</span>`;
}

function renderFilterBar() {
  const el = $('#activeFilter');
  const tag = state.tags.find((t) => t.id === filters.tag);
  el.hidden = !tag;
  if (tag) el.innerHTML = `Filtrando pela tag <span class="tag" style="--t:${esc(tag.color)}">${esc(tag.name)}</span> <button class="link-btn" id="clearTag">limpar</button>`;
}

function tagHtml(id) {
  const t = state.tags.find((x) => x.id === id);
  return t ? `<span class="tag" style="--t:${esc(t.color)}">${esc(t.name)}</span>` : '';
}

const ICON_CLOCK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';
const ICON_REPEAT = '<svg viewBox="0 0 24 24"><path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg>';
const ICON_GCAL = '<svg viewBox="0 0 24 24"><path d="M4 6h16v14H4zM4 10h16"/></svg>';

function cardHtml(t) {
  const s = dueState(t);
  const done = t.checklist.filter((c) => c.done).length;
  const c = colorHex(t.color);
  return `<article class="card ${t.done ? 'done' : ''}" draggable="true" data-id="${t.id}" style="${c ? `--c:${c}` : ''}">
    <div class="card-top">
      <input type="checkbox" class="check" data-toggle="${t.id}" ${t.done ? 'checked' : ''} aria-label="Concluir">
      <div class="card-title">${esc(t.title)}</div>
    </div>
    <div class="meta">
      <span class="pill prio prio-${t.priority}" title="Prioridade ${PRIORITIES[t.priority].label}">${PRIORITIES[t.priority].mark} ${PRIORITIES[t.priority].label}</span>
      ${t.due ? `<span class="pill ${s}">${ICON_CLOCK}${esc(fmtDue(t))}</span>` : ''}
      ${t.recur?.freq !== 'none' ? `<span class="pill" title="Repete">${ICON_REPEAT}</span>` : ''}
      ${t.checklist.length ? `<span class="pill">${ICON_CHECK}${done}/${t.checklist.length}</span>` : ''}
      ${t.gcal ? `<span class="pill" title="No Google Agenda">${ICON_GCAL}</span>` : ''}
    </div>
    ${t.tags.length ? `<div class="meta">${t.tags.map(tagHtml).join('')}</div>` : ''}
  </article>`;
}

function renderView() {
  const el = $('#view');
  if (view === 'board') el.innerHTML = boardHtml();
  else if (view === 'list') el.innerHTML = listHtml();
  else if (view === 'calendar') el.innerHTML = calendarHtml();
  else if (view === 'automations') el.innerHTML = automationsHtml();
  else el.innerHTML = settingsHtml();
}

function boardHtml() {
  const tasks = visibleTasks();
  return `<div class="board">${state.columns.map((col) => {
    const items = tasks.filter((t) => t.column === col.id).sort((a, b) => (a.done - b.done) || byDue(a, b));
    return `<div class="column" data-col="${col.id}">
      <div class="column-head">${esc(col.name)} <span class="n">${items.length}</span><button class="add" data-add="${col.id}" aria-label="Nova tarefa em ${esc(col.name)}">+</button></div>
      ${items.map(cardHtml).join('') || '<div class="empty-col">Arraste tarefas para cá</div>'}
    </div>`;
  }).join('')}</div>`;
}

function listHtml() {
  const t = todayStr(), wkEnd = addDays(t, 7);
  const tasks = visibleTasks().sort(byDue);
  const groups = [
    ['overdue', 'Atrasadas', (x) => !x.done && dueState(x) === 'overdue'],
    ['', 'Hoje', (x) => !x.done && x.due === t && dueState(x) !== 'overdue'],
    ['', 'Próximos 7 dias', (x) => !x.done && x.due > t && x.due <= wkEnd],
    ['', 'Mais adiante', (x) => !x.done && x.due > wkEnd],
    ['', 'Sem prazo', (x) => !x.done && !x.due],
    ['', 'Concluídas', (x) => x.done],
  ];
  return `<div class="groups">${groups.map(([cls, name, fn]) => {
    const items = tasks.filter(fn);
    if (!items.length) return '';
    return `<div class="group ${cls}"><h2>${name} <span class="n">${items.length}</span></h2><div class="rows">${items.map((x) => {
      const c = colorHex(x.color);
      return `<div class="row-task ${x.done ? 'done' : ''}" data-open="${x.id}" style="${c ? `--c:${c}` : ''}">
        <input type="checkbox" class="check" data-toggle="${x.id}" ${x.done ? 'checked' : ''} aria-label="Concluir">
        <span class="cdot"></span>
        <div class="t"><b>${esc(x.title)}</b><span class="pill prio prio-${x.priority}">${PRIORITIES[x.priority].label}</span>${x.tags.map(tagHtml).join('')}${x.recur?.freq !== 'none' ? `<span class="pill">${ICON_REPEAT}a cada ${x.recur.interval > 1 ? x.recur.interval + ' ' + RECUR_LABEL[x.recur.freq][1] : RECUR_LABEL[x.recur.freq][0]}</span>` : ''}</div>
        <div class="when">${x.due ? esc(fmtDue(x)) : '—'}<br><small>${esc(state.columns.find((c) => c.id === x.column)?.name || '')}</small></div>
      </div>`;
    }).join('')}</div></div>`;
  }).join('') || '<p style="color:var(--muted)">Nenhuma tarefa encontrada com esses filtros.</p>'}</div>`;
}

function calStart() {
  const d = new Date(calMonth);
  const dow = (d.getDay() + 6) % 7; // semana começa na segunda
  d.setDate(d.getDate() - dow);
  return ymd(d);
}

function calendarHtml() {
  const start = calStart(), end = addDays(start, 41), t = todayStr();
  const tasks = visibleTasks();
  const byDay = {};
  const push = (d, html) => (byDay[d] ||= []).push(html);
  for (const x of tasks) {
    const c = colorHex(x.color) || 'var(--accent-2)';
    if (x.due && x.due >= start && x.due <= end) push(x.due, `<div class="ev ${x.done ? 'done' : ''}" draggable="true" data-id="${x.id}" data-open="${x.id}" style="--c:${c}" title="${esc(x.title)}">${x.time ? x.time + ' ' : ''}${esc(x.title)}</div>`);
    for (const d of projections(x, start, end)) push(d, `<div class="ev ghost" data-open="${x.id}" style="--c:${c}" title="Repetição prevista">↻ ${esc(x.title)}</div>`);
  }
  for (const e of gEvents) if (e.date >= start && e.date <= end) push(e.date, `<div class="ev gcal" title="Google Agenda: ${esc(e.title)}">${e.time ? e.time + ' ' : ''}${esc(e.title)}</div>`);
  const month = calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  let cells = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), items = byDay[d] || [];
    const other = parseYmd(d).getMonth() !== calMonth.getMonth();
    cells += `<div class="day ${other ? 'other' : ''} ${d === t ? 'today' : ''}" data-day="${d}">
      <span class="num">${parseYmd(d).getDate()}</span>
      ${items.slice(0, 4).join('')}${items.length > 4 ? `<span class="more">+${items.length - 4} mais</span>` : ''}
    </div>`;
  }
  return `<div class="cal-head">
      <button class="icon-btn" data-cal="-1" aria-label="Mês anterior">‹</button>
      <h2>${month}</h2>
      <button class="icon-btn" data-cal="1" aria-label="Próximo mês">›</button>
      <button class="btn small" data-cal="0">Hoje</button>
      <div class="cal-legend">
        <span><i class="dot" style="background:var(--accent-2)"></i>Entrega</span>
        <span><i class="dot" style="border:1px dashed var(--muted)"></i>Repetição prevista</span>
        <span><i class="dot" style="background:var(--muted)"></i>Google Agenda</span>
        ${gToken() ? '<button class="btn small" id="gReload">Atualizar agenda</button>' : '<button class="btn small" id="gConnect">Conectar Google Agenda</button>'}
      </div>
    </div>
    <div class="cal-wrap"><div class="cal">${cells}</div></div>
    <p style="color:var(--muted);font-size:12px">Clique num dia para criar uma tarefa com esse prazo. Arraste uma tarefa para outro dia para mudar a entrega.</p>`;
}

function optList(obj, sel) { return Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join(''); }
function colOpts(sel) { return state.columns.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join(''); }
function tagOpts(sel, empty = '') { return (empty ? `<option value="">${empty}</option>` : '') + state.tags.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join(''); }
function prioOpts(sel, empty = '') { return (empty ? `<option value="">${empty}</option>` : '') + Object.entries(PRIORITIES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.label}</option>`).join(''); }
function colorOpts(sel) { return '<option value="">Sem cor</option>' + COLORS.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.name}</option>`).join(''); }

function actionValueHtml(a, ri, ai) {
  const attr = `data-rule="${ri}" data-act="${ai}" data-k="value"`;
  switch (a.type) {
    case 'move': return `<select ${attr}>${colOpts(a.value)}</select>`;
    case 'color': return `<select ${attr}>${colorOpts(a.value)}</select>`;
    case 'priority': return `<select ${attr}>${prioOpts(a.value)}</select>`;
    case 'addTag': case 'removeTag': return `<select ${attr}>${tagOpts(a.value)}</select>`;
    default: return '';
  }
}

function automationsHtml() {
  return `<div class="panel-grid">
    <div class="panel">
      <h2>Regras automáticas</h2>
      <p class="help">Cada regra tem um gatilho, um filtro opcional e uma ou mais ações. Elas rodam sozinhas enquanto o Planeja estiver aberto (ou instalado e rodando em segundo plano no navegador).</p>
      ${state.rules.map((r, ri) => `<div class="rule ${r.enabled ? '' : 'off'}">
        <div class="rule-head">
          <label class="switch" title="Ativar ou desativar"><input type="checkbox" data-rule="${ri}" data-k="enabled" ${r.enabled ? 'checked' : ''}><span></span></label>
          <input class="name" data-rule="${ri}" data-k="name" value="${esc(r.name)}" aria-label="Nome da regra">
          <button class="btn small ghost danger" data-delrule="${ri}">Excluir</button>
        </div>
        <div class="rule-line"><span class="lbl">Quando</span>
          <select data-rule="${ri}" data-k="trigger.type">${optList(TRIGGERS, r.trigger.type)}</select>
          ${r.trigger.type === 'moved' ? `<select data-rule="${ri}" data-k="trigger.column">${colOpts(r.trigger.column)}</select>` : ''}
          ${r.trigger.type === 'dueSoon' ? `<input type="number" min="1" max="720" style="width:80px" data-rule="${ri}" data-k="trigger.hours" value="${r.trigger.hours || 24}">` : ''}
        </div>
        <div class="rule-line"><span class="lbl">Se</span>
          <select data-rule="${ri}" data-k="filter.tag">${tagOpts(r.filter?.tag, 'qualquer tag')}</select>
          <select data-rule="${ri}" data-k="filter.priority">${prioOpts(r.filter?.priority, 'qualquer prioridade')}</select>
        </div>
        ${r.actions.map((a, ai) => `<div class="rule-line"><span class="lbl">${ai ? 'e' : 'Então'}</span>
          <div class="action"><select data-rule="${ri}" data-act="${ai}" data-k="type">${optList(ACTIONS, a.type)}</select>${actionValueHtml(a, ri, ai)}
          <button class="btn small ghost" data-delact="${ri}:${ai}" aria-label="Remover ação">✕</button></div></div>`).join('')}
        <div class="rule-line"><span class="lbl"></span><button class="btn small" data-addact="${ri}">+ Ação</button></div>
      </div>`).join('')}
      <div><button class="btn primary" id="addRule">+ Nova regra</button></div>
    </div>
  </div>`;
}

function settingsHtml() {
  const s = state.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  return `<div class="panel-grid">
    <div class="panel">
      <h2>Alertas de prazo</h2>
      <div class="setting"><div class="txt"><b>Notificações do Windows</b><small>Avisos nativos nos lembretes de cada tarefa e nas regras com “Enviar alerta”. Funcionam com o Planeja aberto em alguma aba ou instalado como app.</small></div>
        ${perm === 'unsupported' ? '<span>Este navegador não suporta notificações.</span>' :
          perm === 'denied' ? '<span style="color:var(--danger)">Bloqueadas no navegador. Libere no cadeado da barra de endereço.</span>' :
          `<label class="switch"><input type="checkbox" id="sNotify" ${s.notifications && perm === 'granted' ? 'checked' : ''}><span></span></label>`}
      </div>
      <div class="setting"><div class="txt"><b>Testar</b><small>Mostra um alerta de exemplo agora.</small></div><button class="btn" id="testNotify">Enviar teste</button></div>
    </div>

    <div class="panel">
      <h2>Google Agenda</h2>
      <p class="help">Envia suas tarefas com prazo para o Google Agenda (com cor, lembretes e repetição) e mostra seus eventos no calendário do Planeja. Precisa de um ID de cliente OAuth gratuito, criado uma vez:</p>
      <ol class="steps">
        <li>Abra <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener">console.cloud.google.com</a>, crie um projeto e ative a <b>Google Calendar API</b>.</li>
        <li>Em <b>Tela de consentimento OAuth</b>, escolha “Externo” e adicione seu e-mail como usuário de teste.</li>
        <li>Em <b>Credenciais → Criar credenciais → ID do cliente OAuth</b>, tipo “Aplicativo da Web”, com origem JavaScript autorizada <span class="code">${esc(location.origin)}</span>.</li>
        <li>Cole o ID do cliente abaixo e clique em Conectar.</li>
      </ol>
      <div class="setting"><div class="txt"><b>ID do cliente OAuth</b><small>Termina em .apps.googleusercontent.com</small></div>
        <input id="sClientId" style="flex:1 1 300px" value="${esc(s.googleClientId)}" placeholder="123456-abc.apps.googleusercontent.com"></div>
      <div class="setting"><div class="txt"><b>Conexão</b><small>${gToken() ? 'Conectado nesta sessão.' : 'Desconectado. O Google pede login a cada sessão do navegador.'}</small></div>
        <button class="btn primary" id="sConnect">${gToken() ? 'Reconectar' : 'Conectar'}</button></div>
      <div class="setting"><div class="txt"><b>Sincronizar ao salvar</b><small>Toda tarefa com prazo é enviada/atualizada no Google Agenda quando você salva.</small></div>
        <label class="switch"><input type="checkbox" id="sAutoSync" ${s.autoSync ? 'checked' : ''}><span></span></label></div>
      <div class="setting"><div class="txt"><b>Duração dos eventos com horário</b></div>
        <select id="sEventMin">${[15, 30, 60, 90, 120].map((m) => `<option value="${m}" ${+s.eventMinutes === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></div>
    </div>

    <div class="panel">
      <h2>Outras agendas (Outlook, Apple, qualquer app)</h2>
      <div class="setting"><div class="txt"><b>Exportar arquivo .ics</b><small>Inclui prazos, repetições e lembretes. Importe no Outlook, Apple Calendar ou Google Agenda.</small></div>
        <button class="btn" id="exportIcs">Baixar .ics</button></div>
    </div>

    <div class="panel">
      <h2>Colunas do quadro</h2>
      <p class="help">A última coluna é a de concluídas.</p>
      ${state.columns.map((c, i) => `<div class="col-edit"><input data-colname="${i}" value="${esc(c.name)}" style="flex:1">${state.columns.length > 2 ? `<button class="btn small ghost danger" data-delcol="${i}">Excluir</button>` : ''}</div>`).join('')}
      <div><button class="btn" id="addCol">+ Coluna</button></div>
    </div>

    <div class="panel" id="tagsPanel">
      <h2>Tags</h2>
      ${state.tags.map((t, i) => `<div class="tag-edit"><input type="color" data-tagcolor="${i}" value="${esc(t.color)}" aria-label="Cor da tag"><input data-tagname="${i}" value="${esc(t.name)}" style="flex:1"><button class="btn small ghost danger" data-deltag="${i}">Excluir</button></div>`).join('')}
      <div class="tag-edit"><input type="color" id="newTagColor" value="#0ca678" aria-label="Cor da nova tag"><input id="newTagName" placeholder="Nova tag" style="flex:1"><button class="btn" id="addTag">Adicionar</button></div>
    </div>

    <div class="panel">
      <h2>Aparência e dados</h2>
      <div class="setting"><div class="txt"><b>Tema</b></div>
        <select id="sTheme"><option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>Automático</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>Claro</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Escuro</option></select></div>
      <div class="setting"><div class="txt"><b>Backup</b><small>Seus dados ficam só neste navegador. Exporte um backup de vez em quando.</small></div>
        <div class="row"><button class="btn" id="exportJson">Exportar backup</button><label class="btn">Importar backup<input type="file" id="importJson" accept=".json,application/json" hidden></label></div></div>
      <div class="setting"><div class="txt"><b>Tarefas de exemplo</b><small>${state.tasks.filter((t) => t.example).length} tarefas de exemplo no quadro.</small></div>
        <button class="btn danger" id="clearExamples">Apagar exemplos</button></div>
    </div>
  </div>`;
}

// ---------- Editor de tarefa ----------
let dlgTaskId = null;
let draft = null;

function blankTask(o = {}) {
  return { id: uid(), title: '', notes: '', column: firstColumn(), priority: 'medium', color: '', tags: filters.tag ? [filters.tag] : [], start: '', due: '', time: '',
    recur: { freq: 'none', interval: 1, until: '' }, checklist: [], reminders: [1440, 60], done: false, completedAt: null, gcal: null, ruleLog: {}, createdAt: Date.now(), ...o };
}

function openEditor(id, preset = {}) {
  const existing = id && getTask(id);
  draft = existing ? clone(existing) : blankTask(preset);
  dlgTaskId = existing ? id : null;
  $('#fTitle').value = draft.title;
  $('#fColumn').innerHTML = colOpts(draft.column);
  $('#fPriority').value = draft.priority;
  $('#fStart').value = draft.start;
  $('#fDue').value = draft.due;
  $('#fTime').value = draft.time;
  $('#fRecur').value = draft.recur.freq;
  $('#fInterval').value = draft.recur.interval;
  $('#fUntil').value = draft.recur.until;
  $('#fNotes').value = draft.notes;
  $('#deleteTask').hidden = !existing;
  renderSwatches(); renderTagPicker(); renderReminders(); renderChecklist(); renderGcalLine(draft);
  $('#taskDialog').showModal();
  if (!existing) $('#fTitle').focus();
}

function renderSwatches() {
  const custom = draft.color && draft.color.startsWith('#');
  $('#fColors').innerHTML = `<button type="button" class="swatch none ${!draft.color ? 'sel' : ''}" data-color="" title="Sem cor">∅</button>` +
    COLORS.map((c) => `<button type="button" class="swatch ${draft.color === c.id ? 'sel' : ''}" style="--c:${c.hex}" data-color="${c.id}" title="${c.name}"></button>`).join('') +
    `<input type="color" id="fCustomColor" value="${custom ? draft.color : '#8b5cf6'}" title="Cor personalizada" ${custom ? 'style="outline:2px solid var(--fg)"' : ''}>`;
}
function renderTagPicker() {
  $('#fTags').innerHTML = state.tags.map((t) => `<button type="button" class="chip tagchip ${draft.tags.includes(t.id) ? 'on' : ''}" style="--t:${esc(t.color)}" data-tagpick="${t.id}"><span class="dot" style="background:${esc(t.color)}"></span>${esc(t.name)}</button>`).join('') +
    '<button type="button" class="chip" id="quickTag">+ Nova tag</button>';
}
function renderReminders() {
  $('#fReminders').innerHTML = REMINDER_OPTIONS.map((r) => `<button type="button" class="chip ${draft.reminders.includes(r.m) ? 'on' : ''}" data-rem="${r.m}">${r.label}</button>`).join('');
}
function renderChecklist() {
  $('#fChecklist').innerHTML = draft.checklist.map((c, i) => `<li class="${c.done ? 'ok' : ''}"><input type="checkbox" data-ci="${i}" ${c.done ? 'checked' : ''}><span>${esc(c.text)}</span><button type="button" data-cdel="${i}" aria-label="Remover item">✕</button></li>`).join('');
  const d = draft.checklist.filter((c) => c.done).length;
  $('#checkProgress').textContent = draft.checklist.length ? `${d} de ${draft.checklist.length}` : '';
}
function renderGcalLine(t) {
  $('#gcalLine').innerHTML = t.gcal?.link ? `No Google Agenda · <a href="${esc(t.gcal.link)}" target="_blank" rel="noopener">abrir evento</a>` : t.gcal?.series ? 'Faz parte de uma série que já está no Google Agenda.' : '';
  $('#syncTask').textContent = t.gcal?.id && !t.gcal.series ? 'Atualizar no Google Agenda' : 'Enviar ao Google Agenda';
}

function readForm() {
  draft.title = $('#fTitle').value.trim();
  draft.priority = $('#fPriority').value;
  draft.start = $('#fStart').value;
  draft.due = $('#fDue').value;
  draft.time = draft.due ? $('#fTime').value : '';
  draft.recur = { freq: $('#fRecur').value, interval: Math.max(1, +$('#fInterval').value || 1), until: $('#fUntil').value };
  draft.notes = $('#fNotes').value;
  return $('#fColumn').value;
}

function commitDraft() {
  const column = readForm();
  if (!draft.title) { $('#fTitle').focus(); toast('Dê um nome para a tarefa.'); return null; }
  let task = dlgTaskId && getTask(dlgTaskId);
  if (task) {
    const prevDue = task.due + task.time;
    Object.assign(task, draft, { column: task.column, done: task.done });
    if (prevDue !== task.due + task.time) task.ruleLog = {}; // novo prazo: regras de tempo valem de novo
    if (column !== task.column) moveTask(task, column);
  } else {
    task = { ...draft, column };
    delete task.example;
    state.tasks.push(task);
    fire('created', task);
    if (column === doneColumn()) setDone(task, true);
  }
  checkTimeRules();
  save();
  if (state.settings.autoSync && gToken() && task.due) pushToGoogle(task, { quiet: true });
  return task;
}

// ---------- Eventos ----------
function bind() {
  $('#nav').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  $('#search').addEventListener('input', (e) => { filters.q = e.target.value; renderView(); });
  $('#filterPriority').addEventListener('change', (e) => { filters.priority = e.target.value; renderView(); });
  $('#hideDone').addEventListener('change', (e) => { filters.hideDone = e.target.checked; renderView(); });
  $('#newTaskBtn').addEventListener('click', () => openEditor(null));
  $('#manageTags').addEventListener('click', () => { setView('settings'); setTimeout(() => $('#tagsPanel')?.scrollIntoView({ behavior: 'smooth' }), 50); });
  $('#bellBtn').addEventListener('click', () => { $('#alertDrawer').hidden = !$('#alertDrawer').hidden; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $('#alertDrawer').hidden = true;
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('#taskDialog').open) { e.preventDefault(); openEditor(null); }
  });

  // Cliques gerais (delegação)
  document.addEventListener('click', async (e) => {
    const el = e.target;
    const close = el.closest('[data-close]');
    if (close) { $('#' + close.dataset.close).hidden = true; return; }
    if (el.matches('[data-toggle]')) {
      e.stopPropagation();
      const t = getTask(el.dataset.toggle);
      setDone(t, el.checked);
      save(); render();
      if (t.done) toast(`Concluída: ${t.title}`, { label: 'Desfazer', run: () => { setDone(t, false); save(); render(); } });
      return;
    }
    const tagBtn = el.closest('[data-tag]');
    if (tagBtn) { filters.tag = filters.tag === tagBtn.dataset.tag ? '' : tagBtn.dataset.tag; render(); return; }
    if (el.id === 'clearTag') { filters.tag = ''; render(); return; }
    const add = el.closest('[data-add]');
    if (add) { openEditor(null, { column: add.dataset.add }); return; }
    const open = el.closest('[data-open]') || el.closest('.card[data-id]');
    if (open && !el.closest('dialog')) {
      openEditor(open.dataset.open || open.dataset.id);
      if (open.classList.contains('alert')) $('#alertDrawer').hidden = true;
      return;
    }
    const day = el.closest('[data-day]');
    if (day && view === 'calendar') { openEditor(null, { due: day.dataset.day }); return; }
    const cal = el.closest('[data-cal]');
    if (cal) {
      const n = +cal.dataset.cal;
      if (n === 0) { const d = new Date(); calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
      else calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1);
      renderView(); loadGoogleMonth(); return;
    }
    if (el.id === 'gConnect' || el.id === 'sConnect') { if (await connectGoogle()) loadGoogleMonth(); return; }
    if (el.id === 'gReload') { loadGoogleMonth(); return; }
    handleAutomationClick(el) || handleSettingsClick(el);
  });

  // Edição das regras e ajustes
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.closest('#taskDialog')) return;
    if (el.dataset.rule !== undefined) { editRule(el); return; }
    if (el.id === 'sNotify') return toggleNotifications(el);
    if (el.id === 'sClientId') { state.settings.googleClientId = el.value.trim(); save(); toast('ID do cliente salvo'); return; }
    if (el.id === 'sAutoSync') { state.settings.autoSync = el.checked; save(); return; }
    if (el.id === 'sEventMin') { state.settings.eventMinutes = +el.value; save(); return; }
    if (el.id === 'sTheme') { state.settings.theme = el.value; applyTheme(); save(); return; }
    if (el.dataset.colname !== undefined) { state.columns[+el.dataset.colname].name = el.value.trim() || 'Sem nome'; save(); renderSidebar(); return; }
    if (el.dataset.tagname !== undefined) { state.tags[+el.dataset.tagname].name = el.value.trim() || 'Sem nome'; save(); renderSidebar(); return; }
    if (el.dataset.tagcolor !== undefined) { state.tags[+el.dataset.tagcolor].color = el.value; save(); renderSidebar(); return; }
    if (el.id === 'importJson') return importBackup(el.files[0]);
  });

  bindDialog();
  bindDrag();
}

function editRule(el) {
  const r = state.rules[+el.dataset.rule];
  const k = el.dataset.k;
  const val = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
  if (el.dataset.act !== undefined) {
    const a = r.actions[+el.dataset.act];
    a[k] = val;
    if (k === 'type') a.value = { move: doneColumn(), color: 'green', priority: 'high', addTag: state.tags[0]?.id, removeTag: state.tags[0]?.id }[val] || '';
  } else if (k.includes('.')) {
    const [o, p] = k.split('.');
    r[o] ||= {};
    r[o][p] = val;
    if (k === 'trigger.type') { if (val === 'moved') r.trigger.column ||= doneColumn(); if (val === 'dueSoon') r.trigger.hours ||= 24; }
  } else r[k] = val;
  save();
  if (k !== 'name') renderView();
}

function handleAutomationClick(el) {
  if (el.id === 'addRule') {
    state.rules.push({ id: uid(), name: 'Nova regra', enabled: true, trigger: { type: 'completed' }, filter: {}, actions: [{ type: 'color', value: 'green' }] });
    save(); renderView(); return true;
  }
  if (el.dataset.addact !== undefined) { state.rules[+el.dataset.addact].actions.push({ type: 'notify' }); save(); renderView(); return true; }
  if (el.dataset.delact !== undefined) { const [r, a] = el.dataset.delact.split(':').map(Number); state.rules[r].actions.splice(a, 1); save(); renderView(); return true; }
  if (el.dataset.delrule !== undefined) {
    confirmBox(`Excluir a regra “${state.rules[+el.dataset.delrule].name}”?`).then((ok) => { if (ok) { state.rules.splice(+el.dataset.delrule, 1); save(); renderView(); } });
    return true;
  }
  return false;
}

function handleSettingsClick(el) {
  if (el.id === 'testNotify') { notify({ id: 'teste', title: 'Alerta de teste', due: todayStr(), time: '', priority: 'medium' }, 'teste'); return; }
  if (el.id === 'exportIcs') { download('planeja.ics', buildIcs(state.tasks), 'text/calendar'); toast('Arquivo planeja.ics baixado'); return; }
  if (el.id === 'exportJson') { download(`planeja-backup-${todayStr()}.json`, JSON.stringify(state, null, 2), 'application/json'); return; }
  if (el.id === 'addCol') { state.columns.splice(state.columns.length - 1, 0, { id: uid(), name: 'Nova coluna' }); save(); renderView(); return; }
  if (el.dataset.delcol !== undefined) {
    const i = +el.dataset.delcol, col = state.columns[i];
    confirmBox(`Excluir a coluna “${col.name}”? As tarefas dela vão para “${state.columns[i === 0 ? 1 : 0].name}”.`).then((ok) => {
      if (!ok) return;
      const dest = state.columns[i === 0 ? 1 : 0].id;
      state.tasks.forEach((t) => { if (t.column === col.id) t.column = dest; });
      state.columns.splice(i, 1); save(); render();
    });
    return;
  }
  if (el.id === 'addTag') {
    const name = $('#newTagName').value.trim();
    if (!name) return;
    state.tags.push({ id: uid(), name, color: $('#newTagColor').value }); save(); render(); return;
  }
  if (el.dataset.deltag !== undefined) {
    const tag = state.tags[+el.dataset.deltag];
    confirmBox(`Excluir a tag “${tag.name}”? Ela sai de todas as tarefas.`).then((ok) => {
      if (!ok) return;
      state.tasks.forEach((t) => (t.tags = t.tags.filter((x) => x !== tag.id)));
      state.tags.splice(+el.dataset.deltag, 1);
      if (filters.tag === tag.id) filters.tag = '';
      save(); render();
    });
    return;
  }
  if (el.id === 'clearExamples') {
    confirmBox('Apagar todas as tarefas de exemplo?').then((ok) => { if (ok) { state.tasks = state.tasks.filter((t) => !t.example); save(); render(); } });
  }
}

async function toggleNotifications(el) {
  if (el.checked) {
    const p = await Notification.requestPermission();
    state.settings.notifications = p === 'granted';
    if (p !== 'granted') { el.checked = false; toast('O navegador não liberou as notificações.'); }
    else toast('Notificações ativadas');
  } else state.settings.notifications = false;
  save();
}

function importBackup(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data.tasks) || !Array.isArray(data.columns)) throw new Error();
      if (!(await confirmBox(`Substituir tudo pelos dados do backup (${data.tasks.length} tarefas)?`))) return;
      state = { ...data, settings: { ...defaultState().settings, ...data.settings }, notified: data.notified || {}, rules: data.rules || [], tags: data.tags || [] };
      applyTheme();
      save(); render(); toast('Backup importado');
    } catch { toast('Esse arquivo não é um backup do Planeja.'); }
  };
  r.readAsText(file);
}

function bindDialog() {
  const dlg = $('#taskDialog');
  $('#closeTask').addEventListener('click', () => dlg.close());
  $('#taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (commitDraft()) { dlg.close(); render(); }
  });
  $('#deleteTask').addEventListener('click', async () => {
    const t = getTask(dlgTaskId);
    if (!t) return;
    dlg.close();
    const idx = state.tasks.indexOf(t);
    state.tasks.splice(idx, 1);
    save(); render();
    toast(`Tarefa excluída: ${t.title}`, { label: 'Desfazer', run: () => { state.tasks.splice(idx, 0, t); save(); render(); } });
  });
  $('#syncTask').addEventListener('click', async () => {
    const t = commitDraft();
    if (!t) return;
    dlgTaskId = t.id;
    render();
    await pushToGoogle(t);
  });
  dlg.addEventListener('click', (e) => {
    const el = e.target;
    if (el === dlg) { dlg.close(); return; } // clique no fundo fecha
    const sw = el.closest('[data-color]');
    if (sw) { draft.color = sw.dataset.color; renderSwatches(); return; }
    const tp = el.closest('[data-tagpick]');
    if (tp) { const id = tp.dataset.tagpick; draft.tags = draft.tags.includes(id) ? draft.tags.filter((x) => x !== id) : [...draft.tags, id]; renderTagPicker(); return; }
    if (el.id === 'quickTag') {
      const wrap = $('#fTags');
      wrap.innerHTML += '<span class="row"><input id="qtName" placeholder="Nome da tag" style="width:140px"><button type="button" class="btn small" id="qtSave">Criar</button></span>';
      $('#qtName').focus();
      return;
    }
    if (el.id === 'qtSave') {
      const name = $('#qtName').value.trim();
      if (!name) return;
      const t = { id: uid(), name, color: COLORS[state.tags.length % COLORS.length].hex };
      state.tags.push(t); draft.tags.push(t.id); save(); renderTagPicker(); renderSidebar(); return;
    }
    const rem = el.closest('[data-rem]');
    if (rem) { const m = +rem.dataset.rem; draft.reminders = draft.reminders.includes(m) ? draft.reminders.filter((x) => x !== m) : [...draft.reminders, m].sort((a, b) => b - a); renderReminders(); return; }
    if (el.dataset.cdel !== undefined) { draft.checklist.splice(+el.dataset.cdel, 1); renderChecklist(); return; }
    if (el.id === 'fCheckAdd') addCheckItem();
  });
  dlg.addEventListener('change', (e) => {
    if (e.target.id === 'fCustomColor') { draft.color = e.target.value; renderSwatches(); }
    if (e.target.dataset.ci !== undefined) { draft.checklist[+e.target.dataset.ci].done = e.target.checked; renderChecklist(); }
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'fCheckNew') { e.preventDefault(); addCheckItem(); }
    if (e.key === 'Enter' && e.target.id === 'qtName') { e.preventDefault(); $('#qtSave').click(); }
  });
}
function addCheckItem() {
  const inp = $('#fCheckNew');
  const text = inp.value.trim();
  if (!text) return;
  draft.checklist.push({ id: uid(), text, done: false });
  inp.value = '';
  renderChecklist();
}

// Arrastar e soltar: entre colunas do quadro e entre dias do calendário.
function bindDrag() {
  let dragId = null;
  document.addEventListener('dragstart', (e) => {
    const c = e.target.closest?.('[draggable][data-id]');
    if (!c) return;
    dragId = c.dataset.id;
    c.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  document.addEventListener('dragend', (e) => { e.target.classList?.remove('dragging'); $$('.drag-over').forEach((x) => x.classList.remove('drag-over')); });
  document.addEventListener('dragover', (e) => {
    const zone = e.target.closest?.('[data-col], [data-day]');
    if (!zone || !dragId) return;
    e.preventDefault();
    $$('.drag-over').forEach((x) => x !== zone && x.classList.remove('drag-over'));
    zone.classList.add('drag-over');
  });
  document.addEventListener('drop', (e) => {
    const zone = e.target.closest?.('[data-col], [data-day]');
    if (!zone || !dragId) return;
    e.preventDefault();
    const t = getTask(dragId);
    dragId = null;
    if (!t) return;
    if (zone.dataset.col) moveTask(t, zone.dataset.col);
    else if (t.due !== zone.dataset.day) {
      t.due = zone.dataset.day; t.ruleLog = {};
      toast(`Prazo movido para ${fmtDate(t.due)}`);
      if (state.settings.autoSync && gToken() && t.gcal) pushToGoogle(t, { quiet: true });
    }
    checkTimeRules();
    save(); render();
  });
}

function applyTheme() {
  const th = state.settings.theme;
  if (th === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = th;
}

// ---------- Início ----------
load();
applyTheme();
try { const g = JSON.parse(sessionStorage.getItem('planeja:g') || 'null'); if (g && g.exp > Date.now()) gAuth = g; } catch {}
try { const v = localStorage.getItem('planeja:view'); if (VIEW_TITLES[v]) view = v; } catch {}
bind();
checkTimeRules();
checkReminders();
save();
render();
if (view === 'calendar') loadGoogleMonth();
setInterval(tick, 30e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
// (demonstração: sem service worker)
