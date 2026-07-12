(function (global) {
  const typingDelay = 10;
  const randomPools = {
    coffee: [
      'Coffee levels critical.',
      'Developer functioning.',
      'Caffeine restored.',
      'Research may continue.'
    ],
    windows: [
      'Recovered.',
      'Barely.',
      'Never installing Driver Booster again.',
      'System trauma archived.'
    ],
    parasite: [
      'Parasite not found.',
      'Parasite escaped.',
      'Parasite sleeping.',
      'Parasite watching.'
    ],
    errors: [
      ['ERROR 014', 'Unknown organism.'],
      ['ERROR 071', 'Laboratory rejected the request.'],
      ['ERROR 102', 'Host DNA corrupted.'],
      ['ERROR 404', 'Specimen not archived.'],
      ['ERROR 666', 'Nice try.']
    ]
  };

  const commandRegistry = {
    help: {
      lines: [
        'Available Commands',
        '',
        'help',
        'status',
        'logs',
        'scan',
        'specimens',
        'hosts',
        'founder',
        'clear',
        'about',
        'coffee',
        'windows',
        'parasite',
        'genesis'
      ]
    },
    status: {
      lines: [
        'LABORATORY STATUS',
        '',
        'ONLINE',
        '',
        'Network:',
        'BASE',
        '',
        'Research:',
        'ACTIVE',
        '',
        'Experiment:',
        '#001'
      ]
    },
    hosts: {
      lines: [
        'Current Hosts',
        '',
        '100+',
        '',
        'New hosts continue appearing.'
      ]
    },
    logs: {
      handler(context) {
        if (!context.logs || context.logs.unavailable || context.logs.length === 0) {
          return ['Laboratory Archive unavailable.'];
        }

        return context.logs.slice(-5).reverse().flatMap((log) => [
          `${log.entryLabel} - ${log.title}`,
          log.date || 'Date unknown',
          log.summary,
          ''
        ]).slice(0, -1);
      }
    },
    specimens: {
      lines: [
        'Genesis Collection',
        '',
        '11 specimens archived.',
        '',
        'Further mutations expected.'
      ]
    },
    scan: {
      lines: ['Please use the Scanner module above.']
    },
    about: {
      lines: [
        '0XB20 is not trying to become another memecoin.',
        '',
        'This Laboratory documents every experiment publicly.'
      ]
    },
    founder: {
      lines: [
        'Founder Status',
        '',
        'Location:',
        'Unknown village',
        '',
        'Equipment:',
        '1 Laptop',
        '',
        'Budget:',
        'Questionable',
        '',
        'Coffee:',
        'Required',
        '',
        'Sleep:',
        'Not detected',
        '',
        'Motivation:',
        '100%'
      ]
    },
    coffee: {
      handler: () => [randomFrom(randomPools.coffee)]
    },
    windows: {
      handler: () => [randomFrom(randomPools.windows)]
    },
    parasite: {
      handler: () => [randomFrom(randomPools.parasite)]
    },
    genesis: {
      lines: [
        'Genesis Collection',
        '',
        '11 archived specimens',
        '',
        'Access Level',
        '',
        'PUBLIC'
      ]
    },
    clear: {
      clear: true
    },
    b20: {
      hidden: true,
      lines: ['ACCESS LEVEL INCREASED']
    },
    hello: {
      hidden: true,
      lines: ['Hello, Host.']
    },
    jesse: {
      hidden: true,
      lines: ['Origin acknowledged.']
    },
    base: {
      hidden: true,
      lines: ['Native environment confirmed.']
    },
    developer: {
      hidden: true,
      lines: ['Please let him sleep.']
    },
    gm: {
      hidden: true,
      lines: ['gm ser ☀️']
    }
  };

  let output;
  let input;
  let form;
  let hooks = {};
  let context = {};
  let isPrinting = false;

  function randomFrom(list) {
    if (!Array.isArray(list) || list.length === 0) {
      return 'Laboratory response unavailable.';
    }

    return list[Math.floor(Math.random() * list.length)];
  }

  function sleep(duration) {
    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  }

  function createLine(className, text) {
    const line = document.createElement('p');
    line.className = className;
    line.textContent = text || '';
    return line;
  }

  function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
  }

  async function typeLine(text) {
    const line = createLine('console-line console-response');
    output.append(line);

    for (const character of text) {
      line.textContent += character;
      scrollToBottom();
      await sleep(typingDelay);
    }

    scrollToBottom();
  }

  async function printLines(lines, options) {
    const shouldRefocus = options && options.refocus;
    isPrinting = true;
    input.disabled = true;

    for (const line of lines) {
      await typeLine(line);
    }

    input.disabled = false;
    if (shouldRefocus) {
      input.focus({ preventScroll: true });
    }
    isPrinting = false;
  }

  function getUnknownCommandLines() {
    const [code, message] = randomFrom(randomPools.errors);
    return [code, '', message];
  }

  function resolveCommand(command) {
    const entry = commandRegistry[command];

    if (!entry) {
      return getUnknownCommandLines();
    }

    if (entry.clear) {
      output.replaceChildren();
      return [];
    }

    if (entry.handler) {
      return entry.handler(context);
    }

    return entry.lines;
  }

  function echoCommand(command) {
    const line = createLine('console-line console-command', `LAB> ${command}`);
    output.append(line);
    scrollToBottom();
  }

  async function execute(command) {
    const normalized = command.trim().toLowerCase();

    if (!normalized || isPrinting) {
      return;
    }

    echoCommand(normalized);
    hooks.pushTerminalLine(`Console command received: ${normalized}`);
    hooks.pushActivity({ title: `Console: ${normalized}` });

    const lines = resolveCommand(normalized);

    if (lines.length > 0) {
      await printLines(lines, { refocus: true });
    }
  }

  function init(options) {
    output = document.querySelector('[data-console-output]');
    input = document.querySelector('[data-console-input]');
    form = document.querySelector('[data-console-form]');

    if (!output || !input || !form) {
      return;
    }

    const safeOptions = options || {};

    context = {
      logs: safeOptions.logs || []
    };
    hooks = {
      pushActivity: safeOptions.pushActivity || function () {},
      pushTerminalLine: safeOptions.pushTerminalLine || function () {}
    };

    output.replaceChildren();
    printLines([
      'Laboratory Console attached.',
      'Type help to inspect available commands.'
    ], { refocus: false });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const command = input.value;
      input.value = '';
      execute(command);
    });
  }

  global.B20Console = {
    init
  };
})(window);
