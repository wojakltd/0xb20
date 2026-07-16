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
      logs: fromRoot('logs/'),
      research: fromRoot('research/'),
      evolution: fromRoot('evolution/')
    },
    dataPaths: {
      logs: fromRoot('data/logs.json'),
      evolution: fromRoot('data/evolution.json'),
      researchFeed: fromRoot('research/backend/cache/feed.json'),
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
      logs: [],
      researchFeed: { metadata: null, posts: [] },
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
        currentExperiment: 'Research Infrastructure',
        developmentProgress: 36,
        currentNetwork: 'BASE',
        currentHosts: '100+',
        lastUpdate: 'auto'
      },
      evolution: null
    }
  };
})(window);
