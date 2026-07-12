(function (global) {
  const rootMeta = document.querySelector('meta[name="b20-root"]');
  const root = rootMeta ? rootMeta.getAttribute('content') : './';
  const cleanRoot = root.endsWith('/') ? root : `${root}/`;

  // Relative roots keep data loading working from Vercel and direct local files.
  function fromRoot(path) {
    return `${cleanRoot}${path.replace(/^\//, '')}`;
  }

  global.B20LabConfig = {
    routes: {
      logs: fromRoot('logs/index.html'),
      protocol: fromRoot('protocol/index.html')
    },
    dataPaths: {
      logs: fromRoot('data/logs.json'),
      protocol: fromRoot('data/protocol.json'),
      activity: fromRoot('data/activity.json'),
      status: fromRoot('data/status.json'),
      terminalEvents: fromRoot('data/terminal-events.json'),
      scanner: fromRoot('data/scanner.json')
    },
    bootSequence: [
      'Connecting...',
      'Loading parasite database...',
      'Mounting laboratory filesystem...',
      'Synchronizing Base network...',
      'Loading specimens...',
      'Starting infection monitor...',
      'Laboratory ONLINE'
    ],
    fallback: {
      logs: [
        {
          id: 15,
          logNumber: '015',
          title: 'Laboratory Console Activated',
          date: '2026-07-12',
          type: 'console',
          summary: 'Visitors can now communicate with the Laboratory through an in-universe command terminal.',
          content: 'Today the first interactive terminal entered production. The Laboratory now accepts commands, returns archive data, and responds like a system that is actively being used. This is not a developer console. It is an interface for Hosts who want to test the organism.',
          tags: ['console', 'website', 'deployment'],
          featured: true
        },
        {
          id: 14,
          logNumber: '014',
          title: 'B20 Host Scanner Online',
          date: '2026-07-12',
          type: 'scanner',
          summary: 'The scanner became the primary interactive experiment inside the Laboratory.',
          content: 'The Host Scanner now simulates Base synchronization, parasite database loading, transaction fingerprint analysis, and randomized Host reports. No backend is required. The effect is fictional, but the interface is real enough to invite experimentation.',
          tags: ['scanner', 'host', 'experiment'],
          featured: false
        },
        {
          id: 13,
          logNumber: '013',
          title: 'Laboratory Terminal Attached',
          date: '2026-07-12',
          type: 'website',
          summary: 'Passive system events began streaming into the Laboratory interface.',
          content: 'The Laboratory no longer waits for visitors to act. It prints fictional activity, updates traces, and keeps the operating system feeling alive even when no Host is touching the scanner.',
          tags: ['terminal', 'activity', 'website'],
          featured: false
        },
        {
          id: 12,
          logNumber: '012',
          title: 'Architecture Split',
          date: '2026-07-12',
          type: 'deployment',
          summary: 'The website moved from a single page prototype into a modular static system.',
          content: 'CSS, JavaScript, and data were split into focused modules. The root files remain stable entry points, while expandable behavior now lives under assets and data. Future updates should touch JSON first and HTML only when a new module shell is required.',
          tags: ['architecture', 'deployment', 'maintenance'],
          featured: false
        },
        {
          id: 11,
          logNumber: '011',
          title: 'Windows Resurrected',
          date: '2026-07-12',
          type: 'incident',
          summary: 'The lab machine survived a Windows incident and returned to active research.',
          content: "Today's parasite was not B20. It was Windows itself. The lab machine came back online, the terminal survived, and research continued with cleaner wiring.",
          tags: ['incident', 'windows', 'recovery'],
          featured: false
        },
        {
          id: 5,
          logNumber: '005',
          title: 'Host Count Breach',
          date: '2026-07-10',
          type: 'research',
          summary: 'The experiment reached 100+ Hosts while Experiment #001 stayed active.',
          content: 'The experiment reached 100+ Hosts. Experiment #001 is now active. The organism keeps spreading, slowly enough to stay honest and visibly enough to prove the Laboratory is still building.',
          tags: ['research', 'hosts', 'base'],
          featured: false
        }
      ],
      activity: [
        { time: '22:41', title: 'Laboratory online' },
        { time: '22:14', title: 'Research continues' }
      ],
      terminalEvents: [
        { message: 'Host detected' },
        { message: 'Synchronizing Base' },
        { message: 'Research completed' },
        { message: 'Unknown mutation archived' }
      ],
      scanner: {
        steps: [
          'Connecting to Base...',
          'Loading parasite database...',
          'Reading host DNA...',
          'Scanning transaction fingerprints...',
          'Searching mutation archive...',
          'Synchronizing laboratory...',
          'Analyzing neural patterns...',
          'Finalizing report...'
        ],
        hostStatuses: ['Clean', 'Observed', 'Minimal Exposure', 'Infected', 'Highly Infected', 'Unknown', 'Mutation Detected', 'Unclassified'],
        hostStability: ['Excellent', 'Stable', 'Questionable', 'Critical'],
        riskLevels: ['Low', 'Medium', 'High', 'Extreme'],
        recommendations: ['Observe', 'Monitor', 'Recruit', 'Archive', 'Study', 'Ignore'],
        rareMessages: [
          'This specimen deserves further research.',
          'Interesting mutation detected.',
          'This host already knows about B20.',
          'Possible Genesis candidate.',
          'No known cure.'
        ],
        easterEggs: {
          parasite: ['Parasite vocabulary detected in host input.'],
          b20: ['B20 resonance detected.'],
          infect: ['Voluntary infection phrase archived.'],
          genesis: ['Genesis trace requested.'],
          host: ['Host naming pattern acknowledged.']
        },
        rareSecrets: ['ACCESS LEVEL INCREASED', 'UNKNOWN ENTITY DETECTED']
      },
      status: {
        laboratoryStatus: 'ONLINE',
        currentExperiment: 'Blockchain Infection Scanner',
        developmentProgress: 37,
        currentNetwork: 'BASE',
        currentHosts: '100+',
        lastUpdate: 'auto'
      },
      protocol: null
    }
  };
})(window);
