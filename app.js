(() => {
  'use strict';

  const L = window.AgendaLogic;

  // ---------- Configuração ----------
  const KEY = 'agenda:v1';
  const NOTIFIED_KEY = 'agenda:notified:v1';

  const CATS = {
    pessoal:  { label: 'Pessoal',  color: '#ec4899' },
    trabalho: { label: 'Trabalho', color: '#3b82f6' },
    saude:    { label: 'Saúde',    color: '#10b981' },
    estudos:  { label: 'Estudos',  color: '#8b5cf6' },
    casa:     { label: 'Casa',     color: '#f59e0b' },
    outros:   { label: 'Outros',   color: '#64748b' },
  };

  const REPEAT_LABEL = {
    none: '', daily: 'todo dia', weekly: 'toda semana', monthly: 'todo mês', yearly: 'todo ano',
  };

  // ---------- Armazenamento ----------
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast('Não consegui salvar. O armazenamento do navegador pode estar cheio ou bloqueado.');
    }
  }

  let events = readJSON(KEY, []);
  let notified = readJSON(NOTIFIED_KEY, {});

  const saveEvents = () => writeJSON(KEY, events);
  const saveNotified = () => writeJSON(NOTIFIED_KEY, notified);

  // Limpa avisos antigos (mantém só de ontem em diante)
  (function pruneNotified() {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const limit = L.toISO(y);
    for (const k of Object.keys(notified)) {
      if (k.split('|')[1] < limit) delete notified[k];
    }
    saveNotified();
  })();

  // ---------- Utilitários ----------
  const $ = (sel) => document.querySelector(sel);

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const newId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  const todayISO = () => L.toISO(new Date());

  function fmtLongDate(iso) {
    return L.parseISO(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3200);
  }

  // ---------- Estado de tela ----------
  let selected = todayISO();
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();

  // ---------- Calendário ----------
  function renderCalendar() {
    const first = new Date(viewYear, viewMonth, 1);
    const dim = L.daysInMonth(viewYear, viewMonth);
    const today = todayISO();

    $('#month-title').textContent = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    let html = '';
    for (let i = 0; i < first.getDay(); i++) html += '<span class="cell empty"></span>';

    for (let d = 1; d <= dim; d++) {
      const iso = viewYear + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const evs = L.eventsOn(events, iso);
      const cats = [...new Set(evs.map((e) => e.category))].slice(0, 3);
      const dots = cats.map((c) => `<i style="background:${(CATS[c] || CATS.outros).color}"></i>`).join('');
      const cls = ['cell', iso === today ? 'today' : '', iso === selected ? 'selected' : ''].join(' ');
      html += `<button class="${cls}" data-iso="${iso}" aria-label="${esc(fmtLongDate(iso))}">
        <span class="num">${d}</span><span class="dots">${dots}</span></button>`;
    }
    $('#grid').innerHTML = html;
  }

  // ---------- Agenda do dia ----------
  function renderDay() {
    const evs = L.eventsOn(events, selected);
    const isToday = selected === todayISO();

    $('#day-title').textContent = (isToday ? 'Hoje, ' : '') + fmtLongDate(selected);

    const pending = evs.filter((e) => !L.isDone(e, selected)).length;
    $('#day-count').textContent = evs.length ? `${pending} pendente${pending === 1 ? '' : 's'}` : '';
    $('#day-empty').hidden = evs.length > 0;

    $('#day-list').innerHTML = evs
      .map((ev) => {
        const done = L.isDone(ev, selected);
        const cat = CATS[ev.category] || CATS.outros;
        const meta = [cat.label, REPEAT_LABEL[ev.repeat], ev.notes].filter(Boolean).map(esc).join(' · ');
        return `<li class="item ${done ? 'done' : ''}" style="--cat:${cat.color}" data-id="${esc(ev.id)}">
          <button class="check" data-act="toggle" aria-label="Marcar como feito">${done ? '✓' : ''}</button>
          <button class="body" data-act="edit">
            <span class="title">${esc(ev.title)}</span>
            <span class="meta">${meta}</span>
          </button>
          <span class="time">${ev.time ? esc(ev.time) : 'Dia todo'}</span>
        </li>`;
      })
      .join('');
  }

  function render() {
    renderCalendar();
    renderDay();
  }

  // ---------- Navegação ----------
  function goMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  }

  function goToday() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selected = todayISO();
    render();
  }

  $('#prev').addEventListener('click', () => goMonth(-1));
  $('#next').addEventListener('click', () => goMonth(1));
  $('#month-title').addEventListener('click', goToday);

  $('#grid').addEventListener('click', (e) => {
    const cell = e.target.closest('.cell[data-iso]');
    if (!cell) return;
    selected = cell.dataset.iso;
    render();
  });

  // Deslizar para o lado troca de mês
  (() => {
    let x0 = null;
    const el = document.querySelector('.calendar');
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 60) goMonth(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();

  // ---------- Lista: marcar feito / editar ----------
  $('#day-list').addEventListener('click', (e) => {
    const li = e.target.closest('.item');
    const btn = e.target.closest('[data-act]');
    if (!li || !btn) return;
    const ev = events.find((x) => x.id === li.dataset.id);
    if (!ev) return;

    if (btn.dataset.act === 'toggle') {
      ev.done = ev.done || {};
      if (ev.done[selected]) delete ev.done[selected];
      else ev.done[selected] = true;
      saveEvents();
      renderDay();
    } else {
      openForm(ev);
    }
  });

  // ---------- Formulário ----------
  const overlay = { event: $('#sheet-event'), del: $('#sheet-delete'), settings: $('#sheet-settings') };
  let editing = null;

  $('#f-cats').innerHTML = Object.entries(CATS)
    .map(([id, c], i) =>
      `<label class="chip" style="--c:${c.color}">
         <input type="radio" name="cat" value="${id}" ${i === 0 ? 'checked' : ''}><span>${c.label}</span>
       </label>`)
    .join('');

  function openSheet(el) { el.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeSheet(el) { el.hidden = true; document.body.style.overflow = ''; }

  function openForm(ev) {
    editing = ev || null;
    $('#form-title').textContent = ev ? 'Editar compromisso' : 'Novo compromisso';
    $('#f-title').value = ev ? ev.title : '';
    $('#f-date').value = ev ? ev.date : selected;
    $('#f-time').value = ev ? ev.time || '' : '';
    $('#f-remind').value = String(ev ? ev.remind ?? -1 : 0);
    $('#f-repeat').value = ev ? ev.repeat || 'none' : 'none';
    $('#f-notes').value = ev ? ev.notes || '' : '';
    const cat = ev ? ev.category : 'pessoal';
    const radio = document.querySelector(`input[name="cat"][value="${cat}"]`) || document.querySelector('input[name="cat"]');
    radio.checked = true;
    $('#btn-delete').hidden = !ev;
    $('#btn-ics').hidden = !ev;
    openSheet(overlay.event);
    if (!ev) setTimeout(() => $('#f-title').focus(), 60);
  }

  $('#fab').addEventListener('click', () => openForm(null));

  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#f-title').value.trim();
    const date = $('#f-date').value;
    if (!title || !date) return;

    const time = $('#f-time').value;
    const data = {
      title,
      date,
      time,
      // Sem hora não há como avisar em horário específico
      remind: time ? Number($('#f-remind').value) : -1,
      repeat: $('#f-repeat').value,
      category: document.querySelector('input[name="cat"]:checked').value,
      notes: $('#f-notes').value.trim(),
    };

    if (editing) {
      Object.assign(editing, data);
    } else {
      events.push({ id: newId(), done: {}, skip: [], ...data });
    }

    saveEvents();
    selected = date;
    const d = L.parseISO(date);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    closeSheet(overlay.event);
    render();
    checkDue();
    toast(editing ? 'Compromisso atualizado' : 'Compromisso salvo');
    editing = null;
  });

  // Fechar sheets (botão ✕ ou toque fora)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      closeSheet(overlay.event);
      closeSheet(overlay.settings);
    }
    if (e.target === overlay.event) closeSheet(overlay.event);
    if (e.target === overlay.settings) closeSheet(overlay.settings);
  });

  // ---------- Excluir ----------
  function askDelete() {
    return new Promise((resolve) => {
      openSheet(overlay.del);
      const onClick = (e) => {
        const btn = e.target.closest('[data-choice]');
        if (!btn && e.target !== overlay.del) return;
        overlay.del.removeEventListener('click', onClick);
        closeSheet(overlay.del);
        // O sheet do formulário continua aberto por baixo; mantém o scroll travado
        document.body.style.overflow = overlay.event.hidden ? '' : 'hidden';
        resolve(btn ? btn.dataset.choice : 'cancel');
      };
      overlay.del.addEventListener('click', onClick);
    });
  }

  $('#btn-delete').addEventListener('click', async () => {
    if (!editing) return;
    const ev = editing;

    if (ev.repeat && ev.repeat !== 'none') {
      const choice = await askDelete();
      if (choice === 'cancel') return;
      if (choice === 'one') {
        ev.skip = ev.skip || [];
        // Pula só o dia que está aberto na agenda
        if (!ev.skip.includes(selected)) ev.skip.push(selected);
      } else {
        events = events.filter((x) => x.id !== ev.id);
      }
    } else if (confirm('Excluir este compromisso?')) {
      events = events.filter((x) => x.id !== ev.id);
    } else {
      return;
    }

    saveEvents();
    editing = null;
    closeSheet(overlay.event);
    render();
    toast('Compromisso excluído');
  });

  // ---------- Exportar para o Calendário do iPhone ----------
  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  $('#btn-ics').addEventListener('click', () => {
    if (!editing) return;
    const slug = editing.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'compromisso';
    download(slug + '.ics', L.buildICS(editing), 'text/calendar;charset=utf-8');
    toast('Abra o arquivo e toque em “Adicionar” no Calendário');
  });

  // ---------- Notificações ----------
  const isStandalone = () =>
    window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  function notifStatusText() {
    if (!('Notification' in window)) {
      return isStandalone()
        ? 'Este navegador não oferece notificações.'
        : 'No iPhone, as notificações só ficam disponíveis depois de adicionar o app à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abri-lo por lá.';
    }
    return {
      granted: 'Notificações ativadas ✓',
      denied: 'Notificações bloqueadas. Libere em Ajustes do iPhone → Notificações → Minha Agenda.',
      default: 'Notificações ainda não ativadas.',
    }[Notification.permission];
  }

  function refreshNotifUI() {
    $('#notif-status').textContent = notifStatusText();
    const can = 'Notification' in window && Notification.permission === 'default';
    $('#btn-notif').hidden = !can;
  }

  $('#btn-notif').addEventListener('click', async () => {
    if (!('Notification' in window)) return refreshNotifUI();
    try {
      await Notification.requestPermission();
    } catch { /* ignora */ }
    refreshNotifUI();
  });

  $('#btn-settings').addEventListener('click', () => {
    refreshNotifUI();
    openSheet(overlay.settings);
  });

  async function systemNotify(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
      else new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
    } catch { /* ignora */ }
  }

  function showBanner(ev, iso, minutesLeft) {
    const when =
      minutesLeft > 0 ? `Começa em ${minutesLeft} min (${ev.time})` :
      minutesLeft === 0 ? `É agora (${ev.time})` : `Era às ${ev.time}`;

    const box = document.createElement('div');
    box.className = 'banner';
    box.innerHTML = `<div class="txt"><strong>🔔 ${esc(ev.title)}</strong><span>${esc(when)}</span></div><button>OK</button>`;
    box.querySelector('button').addEventListener('click', () => box.remove());
    $('#banners').prepend(box);

    systemNotify(ev.title, when, ev.id + '|' + iso);
  }

  function checkDue() {
    const due = L.dueNow(events, new Date(), notified);
    if (!due.length) return;
    for (const d of due) {
      notified[d.key] = 1;
      showBanner(d.ev, d.iso, d.minutesLeft);
    }
    saveNotified();
  }

  setInterval(checkDue, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Se o app ficou aberto de um dia para o outro, atualiza o "hoje"
      render();
      checkDue();
    }
  });

  // ---------- Backup ----------
  $('#btn-export').addEventListener('click', () => {
    download('minha-agenda-backup.json', JSON.stringify(events, null, 2), 'application/json');
  });

  $('#btn-import').addEventListener('click', () => $('#file-import').click());

  $('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data) || data.some((x) => !x || !x.id || !x.title || !x.date)) throw new Error('formato');
      if (!confirm(`Importar ${data.length} compromisso(s)? Isso substitui os atuais.`)) return;
      events = data;
      saveEvents();
      render();
      closeSheet(overlay.settings);
      toast('Backup importado');
    } catch {
      toast('Arquivo inválido');
    }
  });

  $('#btn-clear').addEventListener('click', () => {
    if (!confirm('Apagar TODOS os compromissos? Isso não pode ser desfeito.')) return;
    events = [];
    notified = {};
    saveEvents();
    saveNotified();
    render();
    closeSheet(overlay.settings);
    toast('Tudo apagado');
  });

  // ---------- Service worker (modo offline + instalar na Tela de Início) ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // ---------- Início ----------
  render();
  checkDue();
})();
