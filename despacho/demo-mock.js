/* =====================================================================
   DESPACHO — modo demonstração
   Substitui o Supabase por um banco em memória com dados fictícios.
   Nada sai da página: sem login real, sem e-mail, sem upload, sem Google.
   ===================================================================== */
(function () {
  "use strict";

  // ---------- dados fictícios ----------
  const pad = n => String(n).padStart(2, "0");
  const dayISO = (offset = 0) => { const d = new Date(Date.now() + offset * 864e5); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const ago = min => new Date(Date.now() - min * 60000).toISOString();

  const ML = "moraeslima.adv.br", CR = "costaribeiro.adv.br";
  function seed() {
    return {
      clients: [
        { domain: ML, name: "Moraes Lima Advogados", logo_url: "clientes/moraes-lima.svg", color_primary: "#1f7a5c", color_primary_dark: "#155a43", color_soft: "#e8f4ee", color_line: "#cfe2d8", color_ink: "#11241c", font_family: "'Manrope'", font_css_url: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap", contact_email: "contato@exemplo.com.br", active: true, created_at: ago(90000) },
        { domain: CR, name: "Costa & Ribeiro Advogados", logo_url: "clientes/costa-ribeiro.svg", color_primary: "#a5512f", color_primary_dark: "#7f3d22", color_soft: "#f8ede7", color_line: "#ead6cb", color_ink: "#2a1a12", font_family: null, font_css_url: null, contact_email: "contato@exemplo.com.br", active: true, created_at: ago(60000) }
      ],
      client_integrations: [{ domain: ML, chat_webhook_url: "https://chat.googleapis.com/v1/spaces/DEMO/messages?key=demo", updated_at: ago(5000) }],
      messages: [
        { id: "m1", client_domain: ML, thread_email: "rafael@moraeslima.adv.br", author_role: "client", sender_name: "Rafael Moraes", sender_email: "rafael@moraeslima.adv.br", urgency: "Normal", content: "Boa tarde, Dra.! Conseguiu ver a minuta do contrato de prestação de serviços?", read: true, created_at: ago(1500) },
        { id: "m2", client_domain: ML, thread_email: "rafael@moraeslima.adv.br", author_role: "admin", sender_name: "Isabela Dias", sender_email: "isabela@despacho.demo", urgency: "Normal", content: "Oi, Rafael! Vi sim. Deixei os comentários na tarefa e ajustei a cláusula de rescisão.", read: true, created_at: ago(1440) },
        { id: "m3", client_domain: ML, thread_email: "rafael@moraeslima.adv.br", author_role: "client", sender_name: "Rafael Moraes", sender_email: "rafael@moraeslima.adv.br", urgency: "Normal", content: "Perfeito, obrigado!", read: true, created_at: ago(1430) },
        { id: "m4", client_domain: ML, thread_email: "juliana@moraeslima.adv.br", author_role: "client", sender_name: "Juliana Lima", sender_email: "juliana@moraeslima.adv.br", urgency: "Urgente", content: "Dra., o cliente da audiência de amanhã pediu para remarcar. Consegue ver isso hoje?", read: false, created_at: ago(35) },
        { id: "m5", client_domain: CR, thread_email: "paulo@costaribeiro.adv.br", author_role: "client", sender_name: "Paulo Costa", sender_email: "paulo@costaribeiro.adv.br", urgency: "Normal", content: "Recebemos o acesso ao portal, tudo funcionando por aqui. Obrigado!", read: false, created_at: ago(180) }
      ],
      tasks: [
        { id: "t1", client_domain: ML, title: "Revisar petição inicial — Cliente Silva", task_type: "Petição / peça processual", priority: "Alta", due_date: dayISO(-1), status: "Pendente", sender_name: "Juliana Lima", sender_email: "juliana@moraeslima.adv.br", client_name: "Maria Silva (fictícia)", process_number: "0000000-00.2026.8.05.0001", description: "Conferir os pedidos e a fundamentação. Atenção ao valor da causa.", expected_result: "Minuta revisada em .docx com comentários", reference_links: "https://www.cnj.jus.br/", attachments: [{ name: "peticao-inicial.docx", path: "demo/1", size: 182000 }, { name: "laudo.pdf", path: "demo/2", size: 845000 }], created_at: ago(300) },
        { id: "t2", client_domain: ML, title: "Automatizar relatório semanal de prazos", task_type: "Automação / sistema", priority: "Média", due_date: dayISO(4), status: "Em andamento", sender_name: "Rafael Moraes", sender_email: "rafael@moraeslima.adv.br", description: "Gerar toda segunda um resumo dos prazos da semana e enviar para a equipe.", expected_result: "Fluxo automatizado funcionando", attachments: [{ name: "planilha-prazos.xlsx", path: "demo/3", size: 230000 }], created_at: ago(2000) },
        { id: "t3", client_domain: CR, title: "Criar skill de triagem de contratos", task_type: "Skill do Claude / IA", priority: "Baixa", due_date: null, status: "Pendente", sender_name: "Paulo Costa", sender_email: "paulo@costaribeiro.adv.br", description: "Classificar contratos recebidos por risco e apontar cláusulas fora do padrão.", attachments: [{ name: "playbook-contratos.md", path: "demo/4", size: 12000 }], created_at: ago(4000) },
        { id: "t4", client_domain: ML, title: "Parecer sobre adequação à LGPD do site", task_type: "Parecer / pesquisa jurídica", priority: "Média", due_date: dayISO(-6), status: "Concluída", completed_at: ago(3000), sender_name: "Rafael Moraes", sender_email: "rafael@moraeslima.adv.br", description: "Avaliar política de privacidade e banner de cookies.", attachments: [], created_at: ago(12000) }
      ],
      meetings: [
        { id: "r1", client_domain: ML, topic: "Alinhamento de audiência — Caso Silva", meeting_date: dayISO(0), start_time: "15:00", meet_link: "https://meet.google.com/", sender_name: "Juliana Lima", sender_email: "juliana@moraeslima.adv.br", created_at: ago(600) },
        { id: "r2", client_domain: CR, topic: "Kickoff da automação de contratos", meeting_date: dayISO(2), start_time: "10:00", meet_link: "https://meet.google.com/", sender_name: "Paulo Costa", sender_email: "paulo@costaribeiro.adv.br", created_at: ago(900) },
        { id: "r3", client_domain: ML, topic: "Revisão mensal de demandas", meeting_date: dayISO(-3), start_time: "11:00", meet_link: "https://meet.google.com/", sender_name: "Rafael Moraes", sender_email: "rafael@moraeslima.adv.br", created_at: ago(8000) }
      ]
    };
  }

  function createStore() {
    const st = { db: seed(), session: { portal: null, painel: null }, frames: new Set(), listeners: [], mode: "portal" };
    st.emit = (table, row, origin) => {
      st.frames.forEach(f => { try { f.__demoDeliver && f.__demoDeliver(table, row); } catch (e) { /* frame fechado */ } });
      st.listeners.forEach(l => { try { l(table, row, origin); } catch (e) { console.error(e); } });
    };
    st.reset = () => { st.db = seed(); st.session = { portal: null, painel: null }; };
    return st;
  }

  // A página de abertura cria o banco; as telas usam o mesmo banco (sincronizadas).
  if (window.__DEMO_SHELL) { window.__demo = createStore(); return; }
  let S = null;
  try { if (window.parent !== window && window.parent.__demo) S = window.parent.__demo; } catch (e) { /* sem acesso ao pai */ }
  if (!S) S = window.__demo = createStore();
  S.frames.add(window);
  window.addEventListener("pagehide", () => S.frames.delete(window));

  const role = /painel\.html$/.test(location.pathname) ? "painel" : "portal";
  const USERS = {
    portal: { id: "u-rafael", email: "rafael@moraeslima.adv.br", user_metadata: { full_name: "Rafael Moraes" } },
    painel: { id: "u-isabela", email: "isabela@despacho.demo", user_metadata: { full_name: "Isabela Dias" } }
  };

  // ---------- consultas (imitam o supabase-js) ----------
  let seq = 0;
  const newId = () => "d" + Date.now().toString(36) + (seq++);
  const clone = o => JSON.parse(JSON.stringify(o));
  const DEFAULTS = {
    messages: r => ({ author_role: "client", urgency: "Normal", read: false, ...r }),
    tasks: r => ({ status: "Pendente", attachments: [], completed_at: null, ...r }),
  };

  function query(table) {
    const st = { op: "select", filters: [], orders: [], limit: null, payload: null, wantRows: false, conflict: null };
    const rows = () => (S.db[table] = S.db[table] || []);
    const match = r => st.filters.every(f => f(r));

    function run() {
      try {
        if (st.op === "insert") {
          const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map(r => {
            const row = (DEFAULTS[table] || (x => x))({ id: newId(), created_at: new Date().toISOString(), ...clone(r) });
            rows().push(row);
            return row;
          });
          list.forEach(r => S.emit(table, clone(r), role));
          return { data: st.wantRows ? clone(list) : null, error: null };
        }
        if (st.op === "upsert") {
          const key = st.conflict || "id";
          const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map(r => {
            const found = rows().find(x => x[key] === r[key]);
            if (found) return Object.assign(found, clone(r));
            const row = { created_at: new Date().toISOString(), ...clone(r) };
            rows().push(row); return row;
          });
          return { data: st.wantRows ? clone(list) : null, error: null };
        }
        if (st.op === "update") {
          const hit = rows().filter(match);
          hit.forEach(r => Object.assign(r, clone(st.payload)));
          return { data: st.wantRows ? clone(hit) : null, error: null };
        }
        if (st.op === "delete") {
          S.db[table] = rows().filter(r => !match(r));
          return { data: null, error: null };
        }
        let out = rows().filter(match).map(clone);
        if (st.orders.length) {
          out.sort((a, b) => {
            for (const o of st.orders) {
              const x = a[o.col] ?? "", y = b[o.col] ?? "";
              if (x < y) return o.asc ? -1 : 1;
              if (x > y) return o.asc ? 1 : -1;
            }
            return 0;
          });
        }
        if (st.limit != null) out = out.slice(0, st.limit);
        return { data: out, error: null };
      } catch (e) {
        return { data: null, error: { message: String(e.message || e) } };
      }
    }

    const b = {
      select() { if (st.op !== "select") st.wantRows = true; return b; },
      insert(p) { st.op = "insert"; st.payload = p; return b; },
      upsert(p, o) { st.op = "upsert"; st.payload = p; st.conflict = o && o.onConflict; return b; },
      update(p) { st.op = "update"; st.payload = p; return b; },
      delete() { st.op = "delete"; return b; },
      eq(c, v) { st.filters.push(r => r[c] === v); return b; },
      neq(c, v) { st.filters.push(r => r[c] !== v); return b; },
      gte(c, v) { st.filters.push(r => r[c] != null && r[c] >= v); return b; },
      in(c, vs) { st.filters.push(r => vs.includes(r[c])); return b; },
      order(c, o) { st.orders.push({ col: c, asc: !o || o.ascending !== false }); return b; },
      limit(n) { st.limit = n; return b; },
      maybeSingle() { const r = run(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] || null) : r.data, error: r.error }); },
      single() { const r = run(); const d = Array.isArray(r.data) ? r.data[0] : r.data; return Promise.resolve(d ? { data: d, error: null } : { data: null, error: r.error || { message: "nenhum registro" } }); },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); }
    };
    return b;
  }

  // ---------- autenticação simulada ----------
  const authCbs = [];
  const fireAuth = ev => authCbs.forEach(cb => cb(ev, S.session[role]));
  const auth = {
    onAuthStateChange(cb) { authCbs.push(cb); setTimeout(() => cb("INITIAL_SESSION", S.session[role]), 0); return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithOAuth() { S.session[role] = { user: USERS[role] }; setTimeout(() => fireAuth("SIGNED_IN"), 250); return { data: {}, error: null }; },
    async signOut() { S.session[role] = null; fireAuth("SIGNED_OUT"); return { error: null }; },
    async getSession() { return { data: { session: S.session[role] } }; },
    async getUser() { return { data: { user: S.session[role] && S.session[role].user } }; }
  };

  // ---------- tempo real simulado ----------
  const subs = [];
  window.__demoDeliver = (table, row) => {
    subs.forEach(s => {
      if (s.opts.table !== table) return;
      if (s.opts.event !== "INSERT" && s.opts.event !== "*") return;
      if (s.opts.filter) {
        const m = s.opts.filter.match(/^(\w+)=eq\.(.+)$/);
        if (m && String(row[m[1]]) !== m[2]) return;
      }
      setTimeout(() => s.cb({ eventType: "INSERT", new: row }), 120);
    });
  };
  const channel = () => {
    const ch = {
      on(type, opts, cb) { subs.push({ opts, cb }); return ch; },
      subscribe(cb) { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return ch; },
      unsubscribe() {}
    };
    return ch;
  };

  window.supabase = {
    createClient: () => ({
      auth,
      from: query,
      channel,
      removeChannel() {},
      async rpc(name, args) {
        if (name === "is_central_admin") return { data: role === "painel" && !!S.session.painel, error: null };
        if (name === "get_busy_slots") return { data: (S.db.meetings || []).filter(m => m.meeting_date === (args && args.target_date)).map(m => ({ start_time: m.start_time })), error: null };
        return { data: null, error: null };
      },
      storage: {
        from: () => ({
          async upload(path, file) { await new Promise(r => setTimeout(r, 350)); return { data: { path }, error: null }; },
          async remove() { return { data: [], error: null }; },
          async createSignedUrl() { return { data: { signedUrl: "#" }, error: null }; }
        })
      },
      functions: {
        async invoke(name) {
          await new Promise(r => setTimeout(r, 600));
          if (name === "create-meet") return { data: { meetLink: "https://meet.google.com/" }, error: null };
          return { data: { ok: true }, error: null };
        }
      }
    })
  };

  // ---------- ajustes da demonstração (depois que a página carrega) ----------
  window.addEventListener("load", () => {
    if (role === "painel") {
      window.download = () => window.toast && toast("Na versão real, o arquivo abre por um link temporário de 10 minutos.");
      window.emailThread = () => window.toast && toast("Na versão real, abre seu e-mail com a conversa recente.");
      const st = document.createElement("style"); st.textContent = "#btn-notify{display:none!important}"; document.head.appendChild(st);
    } else {
      const a = document.getElementById("email-link");
      if (a) a.addEventListener("click", e => { e.preventDefault(); window.showFeedback && showFeedback("Na versão real, abre o e-mail do escritório para contato."); });
    }
  });
})();
