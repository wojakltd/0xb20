document.documentElement.classList.add('js');

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

window.addEventListener('load', () => {
  if (!window.location.hash) {
    window.scrollTo(0, 0);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const config = window.B20LabConfig;
  const data = window.B20Data;
  const ui = window.B20UI;
  const terminal = window.B20Terminal;
  const scanner = window.B20Scanner;
  const consoleModule = window.B20Console;
  const interactions = window.B20Interactions;

  if (!config || !data || !ui || !terminal || !scanner || !consoleModule || !interactions) {
    console.warn('B20 LAB: module bootstrap failed');
    return;
  }

  ui.runBootSequence(config.bootSequence);
  ui.initReveal();
  interactions.initReactivePanels();

  const [logs, activity, status, terminalEvents, scannerConfig] = await Promise.all([
    data.loadLogs(),
    data.loadActivity(),
    data.loadStatus(),
    data.loadTerminalEvents(),
    data.loadScannerConfig()
  ]);

  const latestLog = data.getFeaturedLog(logs);

  ui.renderLatestLog(latestLog);
  ui.renderStatus(status, latestLog);
  terminal.startActivityFeed(activity);
  terminal.startLiveTerminal(terminalEvents);
  scanner.init(scannerConfig, {
    pushActivity: terminal.pushActivity,
    pushTerminalLine: terminal.pushTerminalLine
  });
  consoleModule.init({
    logs,
    pushActivity: terminal.pushActivity,
    pushTerminalLine: terminal.pushTerminalLine
  });

  console.log('B20 LAB ONLINE');
});
