(() => {
  'use strict';

  const cfg = window.CLIPCLASH_CONFIG || {};
  const configured = Boolean(
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_PUBLISHABLE_KEY &&
    !cfg.SUPABASE_URL.includes('YOUR_') &&
    !cfg.SUPABASE_PUBLISHABLE_KEY.includes('YOUR_')
  );

  const supabase = configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
    : null;

  const state = {
    session: null,
    user: null,
    profile: null,
    clips: [],
    currentView: 'feed',
    gameFilter: ''
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    authBtn: $('authBtn'), heroJoinBtn: $('heroJoinBtn'), exploreBtn: $('exploreBtn'),
    newClipBtn: $('newClipBtn'), emptyPostBtn: $('emptyPostBtn'), accountBtn: $('accountBtn'),
    authModal: $('authModal'), clipModal: $('clipModal'), accountModal: $('accountModal'),
    signupForm: $('signupForm'), loginForm: $('loginForm'), clipForm: $('clipForm'), profileForm: $('profileForm'),
    authMessage: $('authMessage'), clipMessage: $('clipMessage'),
    gameFilter: $('gameFilter'), refreshBtn: $('refreshBtn'), feed: $('feed'), emptyState: $('emptyState'),
    loadingState: $('loadingState'), configWarning: $('configWarning'), feedTitle: $('feedTitle'), logoutBtn: $('logoutBtn'),
    forgotPasswordBtn: $('forgotPasswordBtn')
  };

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function initials(value = 'CC') {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map(p => p[0]).join('') || 'CC').toUpperCase();
  }

  function relativeTime(dateString) {
    const s = Math.max(1, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  }

  function showModal(el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function hideModal(el) { el.classList.add('hidden'); document.body.style.overflow = ''; }

  function setMessage(el, text, type = 'error') {
    el.textContent = text;
    el.className = `form-message ${type}`;
  }

  function clearMessage(el) {
    el.textContent = '';
    el.className = 'form-message hidden';
  }

  function toast(message) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    $('toastHost').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function updateAuthUI() {
    const authed = Boolean(state.user);
    document.querySelectorAll('.auth-only').forEach(el => el.classList.toggle('hidden', !authed));
    els.authBtn.classList.toggle('hidden', authed);
    els.heroJoinBtn.textContent = authed ? 'Post my next clip' : 'Create my account';
    if (authed) {
      const label = state.profile?.display_name || state.profile?.username || state.user.email || 'Player';
      els.accountBtn.textContent = initials(label);
      els.accountBtn.title = state.profile?.username ? `@${state.profile.username}` : 'Account';
    }
  }

  function renderDemo() {
    const demo = [
      {id:'demo1',title:'Last-second clutch 😭',game:'Fortnite',created_at:new Date(Date.now()-8*60000),profiles:{username:'nova',display_name:'Nova'},likes:[1,2,3,4,5],clip_url:'https://www.youtube.com/'},
      {id:'demo2',title:'The cleanest escape I have ever hit',game:'GTA V',created_at:new Date(Date.now()-21*60000),profiles:{username:'driftkid',display_name:'DriftKid'},likes:[1,2,3],clip_url:'https://www.youtube.com/'},
      {id:'demo3',title:'This should NOT have worked 💀',game:'Roblox',created_at:new Date(Date.now()-43*60000),profiles:{username:'pixel',display_name:'Pixel'},likes:[1,2],clip_url:'https://www.youtube.com/'}
    ];
    state.clips = demo;
    renderFeed();
  }

  async function loadProfile() {
    if (!supabase || !state.user) { state.profile = null; updateAuthUI(); return; }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', state.user.id).single();
    if (error) console.warn(error.message);
    state.profile = data || null;
    updateAuthUI();
  }

  async function loadClips() {
    if (!configured) { renderDemo(); return; }
    els.loadingState.classList.remove('hidden');
    els.feed.classList.add('hidden');
    els.emptyState.classList.add('hidden');

    let query = supabase
      .from('clips')
      .select('id,user_id,title,game,clip_url,created_at,profiles(username,display_name),likes(user_id)')
      .limit(60);

    if (state.gameFilter) query = query.eq('game', state.gameFilter);
    query = state.currentView === 'latest'
      ? query.order('created_at', { ascending: false })
      : query.order('created_at', { ascending: false });

    const { data, error } = await query;
    els.loadingState.classList.add('hidden');
    els.feed.classList.remove('hidden');

    if (error) {
      console.error(error);
      toast('Could not load clips. Check Supabase setup.');
      state.clips = [];
    } else {
      state.clips = (data || []).map(c => ({...c, likes: c.likes || []}));
      if (state.currentView === 'feed') {
        state.clips.sort((a,b) => (b.likes?.length || 0) - (a.likes?.length || 0) || new Date(b.created_at)-new Date(a.created_at));
      }
    }
    renderFeed();
  }

  function renderFeed() {
    els.feed.innerHTML = '';
    const clips = state.clips;
    els.emptyState.classList.toggle('hidden', clips.length > 0);
    if (!clips.length) return;

    clips.forEach((clip, index) => {
      const likes = clip.likes || [];
      const liked = state.user && likes.some(l => (l.user_id || l) === state.user.id);
      const creator = clip.profiles || {};
      const card = document.createElement('article');
      card.className = 'clip-card';
      card.innerHTML = `
        <a class="clip-cover" data-game="${escapeHTML(clip.game)}" href="${escapeHTML(clip.clip_url)}" target="_blank" rel="noopener noreferrer">
          <span class="clip-game">${escapeHTML(clip.game).toUpperCase()}</span>
          ${state.currentView === 'feed' ? `<span class="clip-rank">#${index+1}</span>` : ''}
          <span class="clip-play">▶</span>
        </a>
        <div class="clip-body">
          <h3 class="clip-title" title="${escapeHTML(clip.title)}">${escapeHTML(clip.title)}</h3>
          <div class="clip-bottom">
            <div class="creator">
              <div class="creator-avatar">${escapeHTML(initials(creator.display_name || creator.username || 'P'))}</div>
              <div class="creator-meta"><strong>@${escapeHTML(creator.username || 'player')}</strong><span>${relativeTime(clip.created_at)}</span></div>
            </div>
            <button class="like-btn ${liked ? 'liked' : ''}" data-like="${clip.id}">♥ ${likes.length}</button>
          </div>
        </div>`;
      els.feed.appendChild(card);
    });
  }

  async function toggleLike(clipId) {
    if (!configured) { toast('Connect Supabase first to enable real accounts and likes.'); return; }
    if (!state.user) { openAuth('signup'); return; }
    const clip = state.clips.find(c => String(c.id) === String(clipId));
    if (!clip) return;
    const liked = (clip.likes || []).some(l => l.user_id === state.user.id);

    if (liked) {
      const { error } = await supabase.from('likes').delete().eq('clip_id', clipId).eq('user_id', state.user.id);
      if (error) return toast(error.message);
      clip.likes = clip.likes.filter(l => l.user_id !== state.user.id);
    } else {
      const { error } = await supabase.from('likes').insert({ clip_id: clipId, user_id: state.user.id });
      if (error) return toast(error.message);
      clip.likes.push({ user_id: state.user.id });
    }
    renderFeed();
  }

  function openAuth(mode = 'signup') {
    if (!configured) els.configWarning.classList.remove('hidden');
    showModal(els.authModal);
    document.querySelectorAll('[data-auth-mode]').forEach(b => b.classList.toggle('active', b.dataset.authMode === mode));
    els.signupForm.classList.toggle('hidden', mode !== 'signup');
    els.loginForm.classList.toggle('hidden', mode !== 'login');
    clearMessage(els.authMessage);
  }

  async function signup(e) {
    e.preventDefault(); clearMessage(els.authMessage);
    if (!configured) return setMessage(els.authMessage, 'Owner must connect Supabase first. See README.md.', 'error');
    const username = $('signupUsername').value.trim();
    const displayName = $('signupDisplayName').value.trim();
    const email = $('signupEmail').value.trim();
    const password = $('signupPassword').value;
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setMessage(els.authMessage, 'Username: 3–20 letters, numbers or underscores only.');

    const { data: existing } = await supabase.from('profiles').select('id').ilike('username', username).limit(1);
    if (existing?.length) return setMessage(els.authMessage, 'That username is already taken.');

    const redirect = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirect, data: { username, display_name: displayName } }
    });
    if (error) return setMessage(els.authMessage, error.message);
    if (data.user && !data.session) {
      setMessage(els.authMessage, 'Account created! Check your email and click the verification link.', 'success');
      els.signupForm.reset();
    } else {
      setMessage(els.authMessage, 'Account created. You are signed in!', 'success');
    }
  }

  async function login(e) {
    e.preventDefault(); clearMessage(els.authMessage);
    if (!configured) return setMessage(els.authMessage, 'Owner must connect Supabase first. See README.md.');
    const { error } = await supabase.auth.signInWithPassword({ email: $('loginEmail').value.trim(), password: $('loginPassword').value });
    if (error) return setMessage(els.authMessage, error.message);
    hideModal(els.authModal); toast('Welcome back ⚡');
  }

  async function forgotPassword() {
    if (!configured) return toast('Connect Supabase first.');
    const email = $('loginEmail').value.trim();
    if (!email) return setMessage(els.authMessage, 'Enter your email first.');
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return setMessage(els.authMessage, error.message);
    setMessage(els.authMessage, 'Password reset email sent.', 'success');
  }

  async function postClip(e) {
    e.preventDefault(); clearMessage(els.clipMessage);
    if (!state.user) return openAuth('signup');
    const payload = { user_id: state.user.id, title: $('clipName').value.trim(), game: $('clipGame').value, clip_url: $('clipUrl').value.trim() };
    const { error } = await supabase.from('clips').insert(payload);
    if (error) return setMessage(els.clipMessage, error.message);
    els.clipForm.reset(); hideModal(els.clipModal); toast('Clip posted ⚡'); await loadClips();
  }

  async function openAccount() {
    if (!state.user) return;
    await loadProfile();
    const p = state.profile || {};
    $('profileName').textContent = p.display_name || 'Player';
    $('profileHandle').textContent = `@${p.username || 'player'}`;
    $('profileAvatar').textContent = initials(p.display_name || p.username || 'P');
    $('profileDisplayName').value = p.display_name || '';
    $('profileBio').value = p.bio || '';

    if (configured) {
      const [{ count: clipCount }, { data: ownClips }] = await Promise.all([
        supabase.from('clips').select('*', { count:'exact', head:true }).eq('user_id', state.user.id),
        supabase.from('clips').select('id,likes(user_id)').eq('user_id', state.user.id)
      ]);
      const likes = (ownClips || []).reduce((sum, c) => sum + (c.likes?.length || 0), 0);
      $('statClips').textContent = clipCount || 0; $('statLikes').textContent = likes; $('statXp').textContent = (clipCount || 0)*25 + likes*5;
    }
    showModal(els.accountModal);
  }

  async function saveProfile(e) {
    e.preventDefault();
    const { error } = await supabase.from('profiles').update({ display_name:$('profileDisplayName').value.trim(), bio:$('profileBio').value.trim() }).eq('id', state.user.id);
    if (error) return toast(error.message);
    await loadProfile(); toast('Profile saved'); hideModal(els.accountModal);
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    hideModal(els.accountModal); toast('Logged out');
  }

  function setView(view) {
    state.currentView = view === 'latest' ? 'latest' : 'feed';
    els.feedTitle.textContent = state.currentView === 'latest' ? 'Fresh drops' : 'Trending right now';
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.view === state.currentView));
    loadClips();
    $('appSection').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close]'); if (close) hideModal($(close.dataset.close));
    const authMode = e.target.closest('[data-auth-mode]'); if (authMode) openAuth(authMode.dataset.authMode);
    const like = e.target.closest('[data-like]'); if (like) toggleLike(like.dataset.like);
    const nav = e.target.closest('[data-view]');
    if (nav) {
      if (nav.dataset.view === 'profile') openAccount(); else setView(nav.dataset.view);
    }
    if (e.target.classList.contains('modal-backdrop')) hideModal(e.target);
  });

  els.authBtn.addEventListener('click', () => openAuth('signup'));
  els.heroJoinBtn.addEventListener('click', () => state.user ? showModal(els.clipModal) : openAuth('signup'));
  els.exploreBtn.addEventListener('click', () => $('appSection').scrollIntoView({behavior:'smooth'}));
  els.newClipBtn.addEventListener('click', () => showModal(els.clipModal));
  els.emptyPostBtn.addEventListener('click', () => state.user ? showModal(els.clipModal) : openAuth('signup'));
  els.accountBtn.addEventListener('click', openAccount);
  els.signupForm.addEventListener('submit', signup); els.loginForm.addEventListener('submit', login);
  els.clipForm.addEventListener('submit', postClip); els.profileForm.addEventListener('submit', saveProfile);
  els.logoutBtn.addEventListener('click', logout); els.forgotPasswordBtn.addEventListener('click', forgotPassword);
  els.gameFilter.addEventListener('change', () => { state.gameFilter = els.gameFilter.value; loadClips(); });
  els.refreshBtn.addEventListener('click', loadClips);

  async function init() {
    if (!configured) {
      els.configWarning.classList.remove('hidden');
      updateAuthUI(); renderDemo(); return;
    }
    const { data } = await supabase.auth.getSession();
    state.session = data.session; state.user = data.session?.user || null;
    await loadProfile(); await loadClips();
    supabase.auth.onAuthStateChange(async (_event, session) => {
      state.session = session; state.user = session?.user || null;
      await loadProfile(); updateAuthUI();
    });
  }

  init();
})();
