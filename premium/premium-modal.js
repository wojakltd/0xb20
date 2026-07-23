(function (global) {
  const utils = global.B20PremiumUtils;
  let modal = null;

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text) {
      element.textContent = text;
    }
    return element;
  }

  function ensureModal() {
    if (modal) {
      return modal;
    }

    const overlay = createElement('div', 'premium-modal-overlay');
    overlay.hidden = true;

    const panel = createElement('section', 'premium-modal lab-reactive');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'premium-modal-title');

    const eyebrow = createElement('span', 'eyebrow', 'Lab Pass');
    const title = createElement('h2', null, 'Unlock Laboratory');
    title.id = 'premium-modal-title';
    const description = createElement('p', null, 'Lab Pass unlocks advanced features across every 0XB20 Laboratory tool.');

    const grid = createElement('div', 'premium-modal-grid');
    const fields = ['price', 'duration', 'wallet', 'network', 'token', 'feature'].reduce((map, key) => {
      const item = createElement('div');
      const label = createElement('span');
      const value = createElement('strong');
      item.append(label, value);
      grid.appendChild(item);
      map[key] = { label, value };
      return map;
    }, {});

    fields.price.label.textContent = 'Current Price';
    fields.duration.label.textContent = 'License Duration';
    fields.wallet.label.textContent = 'Wallet Address';
    fields.network.label.textContent = 'Network';
    fields.token.label.textContent = 'Supported Token';
    fields.feature.label.textContent = 'Requested Feature';

    const status = createElement('p', 'premium-modal-status', 'Waiting for confirmation.');

    const actions = createElement('div', 'premium-modal-actions');
    const unlock = createElement('button', 'test-primary', 'Unlock');
    unlock.type = 'button';
    const cancel = createElement('button', 'test-secondary', 'Cancel');
    cancel.type = 'button';
    actions.append(unlock, cancel);

    panel.append(eyebrow, title, description, grid, status, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    modal = { overlay, fields, status, unlock, cancel };
    return modal;
  }

  function setStatus(text, isError) {
    const instance = ensureModal();
    instance.status.textContent = text;
    instance.status.classList.toggle('is-error', Boolean(isError));
  }

  function openUnlock(options) {
    const instance = ensureModal();
    const config = options.config || {};
    const walletState = options.walletState || {};
    const token = config.paymentToken || {};

    instance.fields.price.value.textContent = utils.formatPrice(config.priceRaw, token.decimals, token.symbol);
    instance.fields.duration.value.textContent = `${config.durationDays || 30} days`;
    instance.fields.wallet.value.textContent = walletState.address ? utils.shortAddress(walletState.address) : 'Connect required';
    instance.fields.network.value.textContent = config.network || 'BASE';
    instance.fields.token.value.textContent = token.symbol || 'USDC';
    instance.fields.feature.value.textContent = options.featureLabel || 'Laboratory Extension';
    setStatus('Wallet confirmation required.', false);

    instance.overlay.hidden = false;

    return new Promise((resolve) => {
      const cleanup = () => {
        instance.unlock.onclick = null;
        instance.cancel.onclick = null;
      };

      const close = (value) => {
        cleanup();
        instance.overlay.hidden = true;
        instance.unlock.disabled = false;
        instance.cancel.disabled = false;
        resolve(value);
      };

      instance.cancel.onclick = () => close(false);
      instance.unlock.onclick = async () => {
        instance.unlock.disabled = true;
        instance.cancel.disabled = true;
        try {
          await options.onUnlock((message) => setStatus(message, false));
          setStatus('Lab Pass active.', false);
          close(true);
        } catch (error) {
          setStatus(utils.errorMessage(error, 'Unable to unlock Lab Pass.'), true);
          instance.unlock.disabled = false;
          instance.cancel.disabled = false;
        }
      };
    });
  }

  global.B20PremiumModal = {
    openUnlock,
    setStatus
  };
})(window);
