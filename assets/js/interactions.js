(function (global) {
  function updatePointerGlow(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    event.currentTarget.style.setProperty('--cursor-x', `${x}%`);
    event.currentTarget.style.setProperty('--cursor-y', `${y}%`);
  }

  function initReactivePanels() {
    const targets = document.querySelectorAll('.card,.log,.observation,.terminal-panel,.scanner-shell,.console-shell,.archive-shell,.archive-card,.application-card,.buttons a,.scanner-button');

    targets.forEach((target) => {
      target.classList.add('lab-reactive');
      target.addEventListener('mousemove', updatePointerGlow);
      target.addEventListener('mouseleave', () => {
        target.style.removeProperty('--cursor-x');
        target.style.removeProperty('--cursor-y');
      });
    });
  }

  global.B20Interactions = {
    initReactivePanels
  };
})(window);
