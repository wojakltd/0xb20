(function (global) {
  const state = {
    wallet: '',
    dashboard: null,
    premium: null,
    loading: false
  };

  const selectors = {
    field: '[data-profile-field]',
    referralLink: '[data-profile-referral-link]',
    qr: '[data-profile-qr]',
    earnings: '[data-profile-earnings]',
    withdrawals: '[data-profile-withdrawals]',
    purchases: '[data-profile-purchases]',
    materials: '[data-profile-materials]',
    withdrawButton: '[data-profile-withdraw]',
    withdrawMessage: '[data-profile-withdraw-message]',
    labPassAction: '[data-profile-lab-pass-action]'
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function isAddress(value) {
    return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
  }

  function sameAddress(a, b) {
    return String(a || '').toLowerCase() === String(b || '').toLowerCase();
  }

  function shortAddress(address) {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '--';
  }

  function money(value, currency = 'USDC') {
    const amount = Number(value || 0);
    const formatted = amount >= 1000
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return `${formatted} ${currency}`;
  }

  function usd(value) {
    return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  function dateLabel(value) {
    if (!value) {
      return '--';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function setField(name, value) {
    const node = $(`[data-profile-field="${name}"]`);
    if (node) {
      node.textContent = value;
    }
  }

  function setMessage(text, good = false) {
    const node = $(selectors.withdrawMessage);
    if (!node) {
      return;
    }

    node.textContent = text;
    node.classList.toggle('is-good', good);
  }

  async function copyText(text, fallbackMessage) {
    if (!text) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setMessage(fallbackMessage || 'Copied to clipboard.', true);
      return true;
    } catch (error) {
      setMessage('Clipboard unavailable. Copy manually.');
      return false;
    }
  }

  function activeLabPassFromPremium() {
    const premiumState = state.premium || global.B20Premium?.getState?.();
    return Boolean(premiumState?.license?.active);
  }

  function premiumExpiryLabel() {
    const premiumState = state.premium || global.B20Premium?.getState?.();
    const expiresAt = premiumState?.license?.expiresAt;
    return expiresAt ? dateLabel(expiresAt) : '--';
  }

  function readReferrer() {
    const captured = global.B20ReferralCapture?.captureFromUrl?.() || global.B20ReferralCapture?.readStoredReferrer?.() || '';
    return isAddress(captured) && !sameAddress(captured, state.wallet) ? captured : '';
  }

  async function fetchDashboard(wallet) {
    const referrer = readReferrer();
    const params = new URLSearchParams({ wallet });
    if (referrer) {
      params.set('referrer', referrer);
    }

    const response = await fetch(`/api/referral/dashboard?${params.toString()}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Partner dashboard unavailable.');
    }

    return response.json();
  }

  async function loadDashboard(wallet) {
    if (!isAddress(wallet) || state.loading) {
      return;
    }

    state.loading = true;
    setField('statsStatus', 'SYNCING');

    try {
      state.dashboard = await fetchDashboard(wallet);
      renderDashboard();
    } catch (error) {
      setField('statsStatus', 'OFFLINE');
      setMessage(error.message || 'Partner dashboard unavailable.');
      renderDisconnected();
    } finally {
      state.loading = false;
    }
  }

  function renderDisconnected() {
    setField('databaseProvider', 'WAITING');
    setField('accountLabPass', 'Connect Wallet');
    setField('partnerRank', 'Explorer');
    setField('toolsUnlocked', '0 / 8');
    setField('lifetimeSavings', '$0');
    setField('lifetimeEarnings', '$0');
    setField('statsStatus', 'WAITING');
    setField('totalReferrals', '0');
    setField('activeReferrals', '0');
    setField('inactiveReferrals', '0');
    setField('level1', '0');
    setField('level2', '0');
    setField('level3', '0');
    setField('conversionRate', '0%');
    setField('lifetimeRevenue', '$0');
    setField('pendingRewards', '$0');
    setField('availableRewards', '$0');
    setField('withdrawnRewards', '$0');
    setField('withdrawAvailable', '0 USDC');
    setField('withdrawMinimum', '20 USDC');
    setField('minimumWithdraw', '20 USDC MIN');
    setField('profileLabPassStatus', 'Connect Wallet');
    setField('profileLabPassExpires', '--');
    setField('profileLastPayment', '--');
    setField('profilePaymentToken', 'ETH / BASE');

    const link = $(selectors.referralLink);
    if (link) {
      link.value = 'Connect wallet to generate link';
    }

    const qr = $(selectors.qr);
    if (qr) {
      qr.textContent = 'QR';
    }

    renderRows(selectors.earnings, [], 'No partner earnings recorded yet.');
    renderRows(selectors.withdrawals, [], 'No withdrawal requests yet.');
    renderRows(selectors.purchases, [], 'No indexed Lab Pass purchases yet.');
    renderMaterials(null);
    updateWithdrawButton();
  }

  function renderDashboard() {
    const data = state.dashboard;
    if (!data) {
      renderDisconnected();
      return;
    }

    const config = data.config || {};
    const currency = config.currency || 'USDC';
    const progress = data.accountProgress || {};
    const stats = data.stats || {};
    const rewards = data.rewards || {};
    const activeLabPass = activeLabPassFromPremium();
    const toolsTotal = config.toolsTotal || 8;
    const toolsUnlocked = activeLabPass ? (config.toolsUnlockedWithLabPass || 3) : (progress.toolsUnlocked || 0);
    const savings = activeLabPass ? toolsUnlocked * (config.labPassReferenceUsd || 10) : progress.lifetimeSavings || 0;

    setField('databaseProvider', data.database?.persistent ? 'PERSISTENT DB' : 'VOLATILE DB');
    setField('accountLabPass', activeLabPass ? `Active until ${premiumExpiryLabel()}` : progress.labPass || 'Inactive');
    setField('partnerRank', progress.partnerRank || 'Explorer');
    setField('toolsUnlocked', `${toolsUnlocked} / ${toolsTotal}`);
    setField('lifetimeSavings', usd(savings));
    setField('lifetimeEarnings', usd(progress.lifetimeEarnings || rewards.earned));
    setField('statsStatus', 'ONLINE');
    setField('totalReferrals', stats.totalReferrals || 0);
    setField('activeReferrals', stats.activeReferrals || 0);
    setField('inactiveReferrals', stats.inactiveReferrals || 0);
    setField('level1', stats.levels?.level1 || 0);
    setField('level2', stats.levels?.level2 || 0);
    setField('level3', stats.levels?.level3 || 0);
    setField('conversionRate', `${stats.conversionRate || 0}%`);
    setField('lifetimeRevenue', usd(stats.lifetimeRevenue || rewards.earned));
    setField('pendingRewards', money(stats.pending || rewards.pending, currency));
    setField('availableRewards', money(stats.available || rewards.available, currency));
    setField('withdrawnRewards', money(stats.withdrawn || rewards.withdrawn, currency));
    setField('withdrawAvailable', money(rewards.available, currency));
    setField('withdrawMinimum', money(config.minimumWithdraw || 20, currency));
    setField('minimumWithdraw', `${config.minimumWithdraw || 20} ${currency} MIN`);
    setField('profileLabPassStatus', activeLabPass ? 'Active' : 'Inactive');
    setField('profileLabPassExpires', activeLabPass ? premiumExpiryLabel() : '--');
    setField('profileLastPayment', data.purchases?.[0]?.amount ? money(data.purchases[0].amount, data.purchases[0].currency || currency) : '--');
    setField('profilePaymentToken', 'ETH / BASE');

    const linkInput = $(selectors.referralLink);
    if (linkInput) {
      linkInput.value = data.referralLink || '';
    }

    renderQr(data.referralLink);
    renderRows(selectors.earnings, data.earnings || [], 'No partner earnings recorded yet.');
    renderRows(selectors.withdrawals, data.withdrawals || [], 'No withdrawal requests yet.');
    renderRows(selectors.purchases, data.purchases || [], 'No indexed Lab Pass purchases yet.');
    renderMaterials(data.materials);
    renderAnalytics(stats);
    updateWithdrawButton();
  }

  function renderQr(link) {
    const qr = $(selectors.qr);
    if (!qr) {
      return;
    }

    qr.textContent = '';

    if (!link) {
      qr.textContent = 'QR';
      return;
    }

    const image = document.createElement('img');
    image.alt = 'Referral QR code';
    image.loading = 'lazy';
    image.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}`;
    qr.appendChild(image);
  }

  function renderRows(selector, rows, emptyText) {
    const container = $(selector);
    if (!container) {
      return;
    }

    container.textContent = '';

    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'profile-empty';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }

    rows.forEach((row) => {
      const item = document.createElement('div');
      item.className = 'profile-table-row';

      const wallet = document.createElement('strong');
      wallet.textContent = shortAddress(row.wallet || row.sourceWallet || state.wallet);

      const amount = document.createElement('small');
      amount.textContent = row.amount ? money(row.amount, row.currency || 'USDC') : `${row.commission || 0}%`;

      const status = document.createElement('small');
      status.textContent = `${row.status || row.level || 'recorded'} · ${dateLabel(row.timestamp || row.createdAt)}`;

      item.append(wallet, amount, status);
      container.appendChild(item);
    });
  }

  function renderMaterials(materials) {
    const container = $(selectors.materials);
    if (!container) {
      return;
    }

    container.textContent = '';

    if (!materials) {
      const empty = document.createElement('p');
      empty.className = 'profile-empty';
      empty.textContent = 'Connect wallet to generate partner materials.';
      container.appendChild(empty);
      return;
    }

    const entries = [
      ['Invitation', materials.invitation],
      ['X Post', materials.xPost],
      ['Thread', Array.isArray(materials.thread) ? materials.thread.join('\n\n') : ''],
      ['Feature List', Array.isArray(materials.featureList) ? materials.featureList.join('\n') : ''],
      ['Lab Pass', materials.labPass],
      ['Referral Explanation', materials.referralExplanation]
    ];

    entries.forEach(([label, value]) => {
      if (!value) {
        return;
      }

      const card = document.createElement('div');
      card.className = 'profile-material-card';

      const title = document.createElement('span');
      title.textContent = label;

      const pre = document.createElement('pre');
      pre.textContent = value;

      const button = document.createElement('button');
      button.className = 'test-secondary';
      button.type = 'button';
      button.textContent = 'Copy';
      button.addEventListener('click', () => copyText(value, `${label} copied.`));

      card.append(title, pre, button);
      container.appendChild(card);
    });
  }

  function renderAnalytics(stats) {
    const total = Number(stats?.lifetimeRevenue || 0);
    const values = [
      Math.min(100, total * 2),
      Math.min(100, total * 4),
      Math.min(100, total * 7),
      Math.min(100, total * 10)
    ];

    $$('.profile-bars i').forEach((bar, index) => {
      bar.style.setProperty('--value', `${Math.max(8, values[index] || 8)}%`);
    });
  }

  function updateWithdrawButton() {
    const button = $(selectors.withdrawButton);
    const data = state.dashboard;
    const rewards = data?.rewards || {};
    const minimum = Number(data?.config?.minimumWithdraw || 20);
    const available = Number(rewards.available || 0);

    if (!button) {
      return;
    }

    button.disabled = !state.wallet || available < minimum;

    if (!state.wallet) {
      setMessage('Connect wallet to inspect withdrawal status.');
    } else if (available < minimum) {
      setMessage(`Withdrawal unlocks at ${minimum} ${data?.config?.currency || 'USDC'}.`);
    } else {
      setMessage('Reward vault ready. Wallet signature required before request.', true);
    }
  }

  async function requestWithdraw() {
    const data = state.dashboard;
    const rewards = data?.rewards || {};
    const amount = Number(rewards.available || 0);
    const currency = data?.config?.currency || 'USDC';

    if (!state.wallet || amount <= 0) {
      updateWithdrawButton();
      return;
    }

    const nonce = Math.random().toString(16).slice(2);
    const message = [
      '0XB20 Referral Withdrawal',
      `Wallet: ${state.wallet}`,
      `Amount: ${amount} ${currency}`,
      `Nonce: ${nonce}`,
      `Timestamp: ${new Date().toISOString()}`
    ].join('\n');

    try {
      setMessage('Awaiting wallet signature...');
      const signature = await global.B20Wallet?.signMessage?.(message);

      if (!signature) {
        throw new Error('Wallet signature unavailable.');
      }

      const response = await fetch('/api/referral/withdraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ wallet: state.wallet, amount, message, signature })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Withdrawal request rejected.');
      }

      setMessage('Withdrawal request recorded. Owner payout queue updated.', true);
      await loadDashboard(state.wallet);
    } catch (error) {
      setMessage(error.message || 'Withdrawal request failed.');
    }
  }

  function shareUrl(kind) {
    const data = state.dashboard;
    if (!data?.referralLink) {
      setMessage('Connect wallet first.');
      return;
    }

    const text = data.materials?.invitation || `Join the 0XB20 Laboratory.\n\n${data.referralLink}`;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(data.referralLink);
    const url = kind === 'telegram'
      ? `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
      : `https://twitter.com/intent/tweet?text=${encodedText}`;

    global.open(url, '_blank', 'noopener,noreferrer');
  }

  function bindEvents() {
    $(selectors.withdrawButton)?.addEventListener('click', requestWithdraw);
    $(selectors.labPassAction)?.addEventListener('click', async () => {
      if (!global.B20Premium) {
        setMessage('Premium Core unavailable.');
        return;
      }

      try {
        setMessage('Checking Lab Pass on-chain...');
        const unlocked = await global.B20Premium.requireAccess('profile.lab_pass', 'Lab Pass');
        if (unlocked) {
          await global.B20Premium.refreshLicense();
          setMessage('Lab Pass verified on-chain.', true);
        }
      } catch (error) {
        setMessage(error.message || 'Lab Pass inspection failed.');
      }
    });

    $$('[data-profile-copy]').forEach((button) => {
      button.addEventListener('click', () => {
        const kind = button.dataset.profileCopy;
        const data = state.dashboard;

        if (kind === 'referral') {
          copyText(data?.referralLink, 'Referral link copied.');
        }

        if (kind === 'invitation') {
          copyText(data?.materials?.invitation, 'Invitation copied.');
        }
      });
    });

    $$('[data-profile-share]').forEach((button) => {
      button.addEventListener('click', () => shareUrl(button.dataset.profileShare));
    });
  }

  function onWallet(nextState) {
    const address = nextState?.address || '';
    state.wallet = isAddress(address) ? address : '';

    if (state.wallet) {
      loadDashboard(state.wallet);
    } else {
      renderDisconnected();
    }
  }

  function onPremium(nextState) {
    state.premium = nextState;
    renderDashboard();
  }

  function init() {
    bindEvents();
    renderDisconnected();

    global.B20Wallet?.subscribe?.(onWallet);
    global.B20Premium?.subscribe?.(onPremium);

    const walletState = global.B20Wallet?.getState?.();
    if (walletState) {
      onWallet(walletState);
    }

    const premiumState = global.B20Premium?.getState?.();
    if (premiumState) {
      onPremium(premiumState);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
