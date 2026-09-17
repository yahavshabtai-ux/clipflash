(() => {
  'use strict';

  const cfg = window.CLIPCLASH_CONFIG || {};
  const ADMIN_USER_ID = '5d7d65d4-871b-47a7-bd3c-4d64aae93004';

  const configured = Boolean(
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_PUBLISHABLE_KEY &&
    !cfg.SUPABASE_URL.includes('YOUR_') &&
    !cfg.SUPABASE_PUBLISHABLE_KEY.includes('YOUR_')
  );

  const supabase = configured
    ? window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_PUBLISHABLE_KEY
      )
    : null;

  const state = {
    session: null,
    user: null,
    profile: null,
    clips: [],
    currentView: 'feed',
    gameFilter: ''
  };

  const $ = id => document.getElementById(id);

  const els = {
    authBtn: $('authBtn'),
    heroJoinBtn: $('heroJoinBtn'),
    exploreBtn: $('exploreBtn'),
    newClipBtn: $('newClipBtn'),
    emptyPostBtn: $('emptyPostBtn'),
    accountBtn: $('accountBtn'),
    authModal: $('authModal'),
    clipModal: $('clipModal'),
    accountModal: $('accountModal'),
    signupForm: $('signupForm'),
    loginForm: $('loginForm'),
    clipForm: $('clipForm'),
    profileForm: $('profileForm'),
    authMessage: $('authMessage'),
    clipMessage: $('clipMessage'),
    gameFilter: $('gameFilter'),
    refreshBtn: $('refreshBtn'),
    feed: $('feed'),
    emptyState: $('emptyState'),
    loadingState: $('loadingState'),
    configWarning: $('configWarning'),
    feedTitle: $('feedTitle'),
    logoutBtn: $('logoutBtn'),
    forgotPasswordBtn: $('forgotPasswordBtn')
  };

  function escapeHTML(value = '') {
    return String(value).replace(
      /[&<>'"]/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[c])
    );
  }

  function initials(value = 'CC') {
    const parts = value
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return (
      parts
        .slice(0, 2)
        .map(p => p[0])
        .join('') || 'CC'
    ).toUpperCase();
  }

  function relativeTime(dateString) {
    const s = Math.max(
      1,
      Math.floor(
        (Date.now() - new Date(dateString).getTime()) / 1000
      )
    );

    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;

    return `${Math.floor(s / 86400)}d ago`;
  }

  function verifiedBadge() {
    return `
      <span
        title="Verified"
        aria-label="Verified"
        style="
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:16px;
          height:16px;
          margin-left:5px;
          border-radius:50%;
          background:#1d9bf0;
          color:white;
          font-size:11px;
          font-weight:900;
          line-height:1;
          vertical-align:-2px;
        "
      >✓</span>
    `;
  }

  function isAdmin() {
    return Boolean(
      state.user &&
      state.user.id === ADMIN_USER_ID
    );
  }

  function showModal(el) {
    if (!el) return;

    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function hideModal(el) {
    if (!el) return;

    el.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function setMessage(el, text, type = 'error') {
    if (!el) return;

    el.textContent = text;
    el.className = `form-message ${type}`;
  }

  function clearMessage(el) {
    if (!el) return;

    el.textContent = '';
    el.className = 'form-message hidden';
  }

  function toast(message) {
    const host = $('toastHost');

    if (!host) {
      console.log(message);
      return;
    }

    const t = document.createElement('div');

    t.className = 'toast';
    t.textContent = message;

    host.appendChild(t);

    setTimeout(() => {
      t.remove();
    }, 3200);
  }

  function updateAuthUI() {
    const authed = Boolean(state.user);

    document
      .querySelectorAll('.auth-only')
      .forEach(el => {
        el.classList.toggle('hidden', !authed);
      });

    if (els.authBtn) {
      els.authBtn.classList.toggle('hidden', authed);
    }

    if (els.heroJoinBtn) {
      els.heroJoinBtn.textContent =
        authed
          ? 'Post my next clip'
          : 'Create my account';
    }

    if (authed && els.accountBtn) {
      const label =
        state.profile?.display_name ||
        state.profile?.username ||
        state.user.email ||
        'Player';

      els.accountBtn.textContent = initials(label);

      els.accountBtn.title =
        state.profile?.username
          ? `@${state.profile.username}`
          : 'Account';
    }
  }

  function renderDemo() {
    const demo = [
      {
        id: 'demo1',
        title: 'Last-second clutch 😭',
        game: 'Fortnite',
        created_at: new Date(Date.now() - 8 * 60000),
        profiles: {
          username: 'nova',
          display_name: 'Nova',
          verified: true
        },
        likes: [1, 2, 3, 4, 5],
        clip_url: 'https://www.youtube.com/'
      },
      {
        id: 'demo2',
        title: 'The cleanest escape I have ever hit',
        game: 'GTA V',
        created_at: new Date(Date.now() - 21 * 60000),
        profiles: {
          username: 'driftkid',
          display_name: 'DriftKid',
          verified: false
        },
        likes: [1, 2, 3],
        clip_url: 'https://www.youtube.com/'
      }
    ];

    state.clips = demo;
    renderFeed();
  }

  async function loadProfile() {
    if (!supabase || !state.user) {
      state.profile = null;
      updateAuthUI();
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', state.user.id)
      .single();

    if (error) {
      console.warn(error.message);
    }

    state.profile = data || null;

    updateAuthUI();
  }

  async function loadClips() {
    if (!configured) {
      renderDemo();
      return;
    }

    if (els.loadingState) {
      els.loadingState.classList.remove('hidden');
    }

    if (els.feed) {
      els.feed.classList.add('hidden');
    }

    if (els.emptyState) {
      els.emptyState.classList.add('hidden');
    }

    let query = supabase
      .from('clips')
      .select(
        'id,user_id,title,game,clip_url,created_at,profiles:profiles!clips_user_id_fkey(username,display_name,verified),likes(user_id)'
      )
      .limit(60);

    if (state.gameFilter) {
      query = query.eq(
        'game',
        state.gameFilter
      );
    }

    query = query.order(
      'created_at',
      {
        ascending: false
      }
    );

    const {
      data,
      error
    } = await query;

    if (els.loadingState) {
      els.loadingState.classList.add('hidden');
    }

    if (els.feed) {
      els.feed.classList.remove('hidden');
    }

    if (error) {
      console.error('loadClips error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      toast(
        'Could not load clips. Check console.'
      );

      state.clips = [];
    } else {
      state.clips = (data || []).map(c => ({
        ...c,
        likes: c.likes || []
      }));

      if (state.currentView === 'feed') {
        state.clips.sort((a, b) => {
          const likes =
            (b.likes?.length || 0) -
            (a.likes?.length || 0);

          if (likes !== 0) {
            return likes;
          }

          return (
            new Date(b.created_at) -
            new Date(a.created_at)
          );
        });
      }
    }

    renderFeed();
  }

  function renderFeed() {
    if (!els.feed) return;

    els.feed.innerHTML = '';

    const clips = state.clips;

    if (els.emptyState) {
      els.emptyState.classList.toggle(
        'hidden',
        clips.length > 0
      );
    }

    if (!clips.length) return;

    clips.forEach((clip, index) => {
      const likes =
        clip.likes || [];

      const liked =
        state.user &&
        likes.some(l => {
          return (
            (l.user_id || l) ===
            state.user.id
          );
        });

      const creator =
        clip.profiles || {};

      const card =
        document.createElement('article');

      card.className =
        'clip-card';

      const adminButton =
        isAdmin() &&
        clip.user_id &&
        clip.user_id !== ADMIN_USER_ID
          ? `
            <button
              type="button"
              data-verify-user="${escapeHTML(clip.user_id)}"
              data-verified="${creator.verified ? '1' : '0'}"
              style="
                margin-top:6px;
                padding:5px 9px;
                border:1px solid rgba(255,255,255,.15);
                border-radius:8px;
                background:rgba(255,255,255,.08);
                color:white;
                cursor:pointer;
                font-weight:800;
              "
            >
              ${creator.verified ? 'Remove V' : 'Give V'}
            </button>
          `
          : '';

      card.innerHTML = `
        <a
          class="clip-cover"
          data-game="${escapeHTML(clip.game)}"
          href="${escapeHTML(clip.clip_url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="clip-game">
            ${escapeHTML(clip.game).toUpperCase()}
          </span>

          ${
            state.currentView === 'feed'
              ? `<span class="clip-rank">#${index + 1}</span>`
              : ''
          }

          <span class="clip-play">
            ▶
          </span>
        </a>

        <div class="clip-body">
          <h3
            class="clip-title"
            title="${escapeHTML(clip.title)}"
          >
            ${escapeHTML(clip.title)}
          </h3>

          <div class="clip-bottom">

            <div class="creator">

              <div class="creator-avatar">
                ${escapeHTML(
                  initials(
                    creator.display_name ||
                    creator.username ||
                    'P'
                  )
                )}
              </div>

              <div class="creator-meta">

                <strong>
                  @${escapeHTML(
                    creator.username ||
                    'player'
                  )}

                  ${
                    creator.verified
                      ? verifiedBadge()
                      : ''
                  }
                </strong>

                <span>
                  ${relativeTime(clip.created_at)}
                </span>

                ${adminButton}

              </div>
            </div>

            <button
              class="like-btn ${
                liked
                  ? 'liked'
                  : ''
              }"
              data-like="${clip.id}"
            >
              ♥ ${likes.length}
            </button>

          </div>
        </div>
      `;

      els.feed.appendChild(card);
    });
  }

  async function toggleLike(clipId) {
    if (!configured) {
      toast(
        'Connect Supabase first.'
      );
      return;
    }

    if (!state.user) {
      openAuth('signup');
      return;
    }

    const clip =
      state.clips.find(c => {
        return (
          String(c.id) ===
          String(clipId)
        );
      });

    if (!clip) return;

    const liked =
      (clip.likes || []).some(l => {
        return (
          l.user_id ===
          state.user.id
        );
      });

    if (liked) {
      const { error } =
        await supabase
          .from('likes')
          .delete()
          .eq('clip_id', clipId)
          .eq(
            'user_id',
            state.user.id
          );

      if (error) {
        toast(error.message);
        return;
      }

      clip.likes =
        clip.likes.filter(l => {
          return (
            l.user_id !==
            state.user.id
          );
        });
    } else {
      const { error } =
        await supabase
          .from('likes')
          .insert({
            clip_id: clipId,
            user_id: state.user.id
          });

      if (error) {
        toast(error.message);
        return;
      }

      clip.likes.push({
        user_id:
          state.user.id
      });
    }

    renderFeed();
  }

  async function toggleVerification(
    userId,
    currentlyVerified
  ) {
    if (!configured || !supabase) {
      toast(
        'Supabase is not connected.'
      );
      return;
    }

    if (!isAdmin()) {
      toast(
        'Admin only'
      );
      return;
    }

    if (!userId) return;

    const { error } =
      await supabase.rpc(
        'set_user_verified',
        {
          target_user:
            userId,
          new_verified:
            !currentlyVerified
        }
      );

    if (error) {
      console.error(error);

      toast(
        error.message ||
        'Could not change verification.'
      );

      return;
    }

    toast(
      currentlyVerified
        ? 'Verification removed'
        : 'User verified ✓'
    );

    await loadClips();
  }

  function openAuth(mode = 'signup') {
    if (
      !configured &&
      els.configWarning
    ) {
      els.configWarning.classList.remove(
        'hidden'
      );
    }

    showModal(
      els.authModal
    );

    document
      .querySelectorAll(
        '[data-auth-mode]'
      )
      .forEach(b => {
        b.classList.toggle(
          'active',
          b.dataset.authMode === mode
        );
      });

    if (els.signupForm) {
      els.signupForm.classList.toggle(
        'hidden',
        mode !== 'signup'
      );
    }

    if (els.loginForm) {
      els.loginForm.classList.toggle(
        'hidden',
        mode !== 'login'
      );
    }

    clearMessage(
      els.authMessage
    );
  }

  async function signup(e) {
    e.preventDefault();

    clearMessage(
      els.authMessage
    );

    if (!configured) {
      setMessage(
        els.authMessage,
        'Owner must connect Supabase first.',
        'error'
      );
      return;
    }

    const username =
      $('signupUsername')?.value.trim() || '';

    const displayName =
      $('signupDisplayName')?.value.trim() || '';

    const email =
      $('signupEmail')?.value.trim() || '';

    const password =
      $('signupPassword')?.value || '';

    if (
      !/^[A-Za-z0-9_]{3,20}$/.test(
        username
      )
    ) {
      setMessage(
        els.authMessage,
        'Username: 3–20 letters, numbers or underscores only.'
      );

      return;
    }

    const {
      data: existing,
      error: usernameError
    } = await supabase
      .from('profiles')
      .select('id')
      .ilike(
        'username',
        username
      )
      .limit(1);

    if (usernameError) {
      console.warn(
        usernameError
      );
    }

    if (existing?.length) {
      setMessage(
        els.authMessage,
        'That username is already taken.'
      );
      return;
    }

    const redirect =
      `${window.location.origin}${window.location.pathname}`;

    const {
      data,
      error
    } = await supabase.auth.signUp({
      email,
      password,

      options: {
        emailRedirectTo:
          redirect,

        data: {
          username,

          display_name:
            displayName
        }
      }
    });

    if (error) {
      setMessage(
        els.authMessage,
        error.message
      );
      return;
    }

    if (
      data.user &&
      !data.session
    ) {
      setMessage(
        els.authMessage,
        'Account created! Check your email and click the verification link.',
        'success'
      );

      els.signupForm?.reset();
    } else {
      setMessage(
        els.authMessage,
        'Account created. You are signed in!',
        'success'
      );
    }
  }

  async function login(e) {
    e.preventDefault();

    clearMessage(
      els.authMessage
    );

    if (!configured) {
      setMessage(
        els.authMessage,
        'Owner must connect Supabase first.'
      );
      return;
    }

    const email =
      $('loginEmail')?.value.trim() || '';

    const password =
      $('loginPassword')?.value || '';

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      setMessage(
        els.authMessage,
        error.message
      );
      return;
    }

    hideModal(
      els.authModal
    );

    toast(
      'Welcome back ⚡'
    );
  }

  async function forgotPassword() {
    if (!configured) {
      toast(
        'Connect Supabase first.'
      );
      return;
    }

    const email =
      $('loginEmail')?.value.trim() || '';

    if (!email) {
      setMessage(
        els.authMessage,
        'Enter your email first.'
      );
      return;
    }

    const redirectTo =
      `${window.location.origin}${window.location.pathname}`;

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo
        }
      );

    if (error) {
      setMessage(
        els.authMessage,
        error.message
      );
      return;
    }

    setMessage(
      els.authMessage,
      'Password reset email sent.',
      'success'
    );
  }

  async function postClip(e) {
    e.preventDefault();

    clearMessage(
      els.clipMessage
    );

    if (!state.user) {
      openAuth('signup');
      return;
    }

    const payload = {
      user_id:
        state.user.id,

      title:
        $('clipName')?.value.trim() || '',

      game:
        $('clipGame')?.value || '',

      clip_url:
        $('clipUrl')?.value.trim() || ''
    };

    const { error } =
      await supabase
        .from('clips')
        .insert(payload);

    if (error) {
      setMessage(
        els.clipMessage,
        error.message
      );
      return;
    }

    els.clipForm?.reset();

    hideModal(
      els.clipModal
    );

    toast(
      'Clip posted ⚡'
    );

    await loadClips();
  }

  async function openAccount() {
    if (!state.user) return;

    await loadProfile();

    const p =
      state.profile || {};

    if ($('profileName')) {
      $('profileName').textContent =
        p.display_name ||
        'Player';
    }

    if ($('profileHandle')) {
      $('profileHandle').innerHTML =
        `@${escapeHTML(
          p.username ||
          'player'
        )}${
          p.verified
            ? verifiedBadge()
            : ''
        }`;
    }

    if ($('profileAvatar')) {
      $('profileAvatar').textContent =
        initials(
          p.display_name ||
          p.username ||
          'P'
        );
    }

    if ($('profileDisplayName')) {
      $('profileDisplayName').value =
        p.display_name || '';
    }

    if ($('profileBio')) {
      $('profileBio').value =
        p.bio || '';
    }

    if (configured) {
      const [
        { count: clipCount },
        { data: ownClips }
      ] = await Promise.all([

        supabase
          .from('clips')
          .select(
            '*',
            {
              count: 'exact',
              head: true
            }
          )
          .eq(
            'user_id',
            state.user.id
          ),

        supabase
          .from('clips')
          .select(
            'id,likes(user_id)'
          )
          .eq(
            'user_id',
            state.user.id
          )

      ]);

      const likes =
        (ownClips || [])
          .reduce(
            (sum, c) =>
              sum +
              (
                c.likes?.length ||
                0
              ),
            0
          );

      if ($('statClips')) {
        $('statClips').textContent =
          clipCount || 0;
      }

      if ($('statLikes')) {
        $('statLikes').textContent =
          likes;
      }

      if ($('statXp')) {
        $('statXp').textContent =
          (clipCount || 0) * 25 +
          likes * 5;
      }
    }

    showModal(
      els.accountModal
    );
  }

  async function saveProfile(e) {
    e.preventDefault();

    if (
      !supabase ||
      !state.user
    ) {
      return;
    }

    const { error } =
      await supabase
        .from('profiles')
        .update({
          display_name:
            $('profileDisplayName')?.value.trim() || '',

          bio:
            $('profileBio')?.value.trim() || ''
        })
        .eq(
          'id',
          state.user.id
        );

    if (error) {
      toast(
        error.message
      );
      return;
    }

    await loadProfile();

    toast(
      'Profile saved'
    );

    hideModal(
      els.accountModal
    );
  }

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();

    hideModal(
      els.accountModal
    );

    toast(
      'Logged out'
    );
  }

  function setView(view) {
    state.currentView =
      view === 'latest'
        ? 'latest'
        : 'feed';

    if (els.feedTitle) {
      els.feedTitle.textContent =
        state.currentView === 'latest'
          ? 'Fresh drops'
          : 'Trending right now';
    }

    document
      .querySelectorAll('.nav-tab')
      .forEach(b => {
        b.classList.toggle(
          'active',
          b.dataset.view ===
            state.currentView
        );
      });

    loadClips();

    $('appSection')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
  }

  document.addEventListener(
    'click',
    e => {

      const close =
        e.target.closest(
          '[data-close]'
        );

      if (close) {
        hideModal(
          $(close.dataset.close)
        );
      }

      const authMode =
        e.target.closest(
          '[data-auth-mode]'
        );

      if (authMode) {
        openAuth(
          authMode.dataset.authMode
        );
      }

      const like =
        e.target.closest(
          '[data-like]'
        );

      if (like) {
        toggleLike(
          like.dataset.like
        );
      }

      const verify =
        e.target.closest(
          '[data-verify-user]'
        );

      if (verify) {
        toggleVerification(
          verify.dataset.verifyUser,
          verify.dataset.verified === '1'
        );
      }

      const nav =
        e.target.closest(
          '[data-view]'
        );

      if (nav) {
        if (
          nav.dataset.view ===
          'profile'
        ) {
          openAccount();
        } else {
          setView(
            nav.dataset.view
          );
        }
      }

      if (
        e.target.classList.contains(
          'modal-backdrop'
        )
      ) {
        hideModal(
          e.target
        );
      }
    }
  );

  if (els.authBtn) {
    els.authBtn.addEventListener(
      'click',
      () => {
        openAuth('signup');
      }
    );
  }

  if (els.heroJoinBtn) {
    els.heroJoinBtn.addEventListener(
      'click',
      () => {
        state.user
          ? showModal(els.clipModal)
          : openAuth('signup');
      }
    );
  }

  if (els.exploreBtn) {
    els.exploreBtn.addEventListener(
      'click',
      () => {
        $('appSection')
          ?.scrollIntoView({
            behavior: 'smooth'
          });
      }
    );
  }

  if (els.newClipBtn) {
    els.newClipBtn.addEventListener(
      'click',
      () => {
        showModal(
          els.clipModal
        );
      }
    );
  }

  if (els.emptyPostBtn) {
    els.emptyPostBtn.addEventListener(
      'click',
      () => {
        state.user
          ? showModal(els.clipModal)
          : openAuth('signup');
      }
    );
  }

  if (els.accountBtn) {
    els.accountBtn.addEventListener(
      'click',
      openAccount
    );
  }

  if (els.signupForm) {
    els.signupForm.addEventListener(
      'submit',
      signup
    );
  }

  if (els.loginForm) {
    els.loginForm.addEventListener(
      'submit',
      login
    );
  }

  if (els.clipForm) {
    els.clipForm.addEventListener(
      'submit',
      postClip
    );
  }

  if (els.profileForm) {
    els.profileForm.addEventListener(
      'submit',
      saveProfile
    );
  }

  if (els.logoutBtn) {
    els.logoutBtn.addEventListener(
      'click',
      logout
    );
  }

  if (els.forgotPasswordBtn) {
    els.forgotPasswordBtn.addEventListener(
      'click',
      forgotPassword
    );
  }

  if (els.gameFilter) {
    els.gameFilter.addEventListener(
      'change',
      () => {
        state.gameFilter =
          els.gameFilter.value;

        loadClips();
      }
    );
  }

  if (els.refreshBtn) {
    els.refreshBtn.addEventListener(
      'click',
      loadClips
    );
  }

  async function init() {
    if (!configured) {
      if (els.configWarning) {
        els.configWarning.classList.remove(
          'hidden'
        );
      }

      updateAuthUI();
      renderDemo();
      return;
    }

    try {
      const {
        data,
        error
      } = await supabase.auth.getSession();

      if (error) {
        console.error(
          error
        );
      }

      state.session =
        data?.session || null;

      state.user =
        data?.session?.user ||
        null;

      await loadProfile();
      await loadClips();

      supabase.auth.onAuthStateChange(
        async (
          _event,
          session
        ) => {
          state.session =
            session;

          state.user =
            session?.user ||
            null;

          await loadProfile();

          updateAuthUI();

          await loadClips();
        }
      );

    } catch (error) {
      console.error(
        'ClipClash init error:',
        error
      );

      toast(
        'Something went wrong while loading the site.'
      );
    }
  }

  init();
})();