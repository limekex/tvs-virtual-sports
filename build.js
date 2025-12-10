#!/usr/bin/env node
// Build script for TVS Virtual Sports
// Usage: node build.js [--dev] [--watch]

const esbuild = require('esbuild');
const { globalExternalsPlugin } = require('./esbuild.config.js');

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const isWatch = args.includes('--watch');

const baseConfig = {
  bundle: true,
  sourcemap: true,
  format: 'iife',
  plugins: [globalExternalsPlugin],
};

const prodConfig = {
  ...baseConfig,
  minify: true,
};

const devConfig = {
  ...baseConfig,
  minify: false,
};

const config = isDev ? devConfig : prodConfig;

// Build configurations
const builds = [
  {
    ...config,
    entryPoints: ['src/index.js'],
    outfile: 'public/js/tvs-app.js',
  },
  {
    ...config,
    entryPoints: ['src/blocks/my-activities/view.js'],
    outfile: 'public/js/tvs-block-my-activities.js',
  },
  {
    ...config,
    entryPoints: ['src/blocks/route-insights/view.js'],
    outfile: 'public/js/tvs-block-route-insights.js',
  },
  {
    ...config,
    entryPoints: ['src/blocks/personal-records/view.js'],
    outfile: 'public/js/tvs-block-personal-records.js',
  },
  {
    ...config,
    entryPoints: ['src/blocks/activity-heatmap/view.js'],
    outfile: 'public/js/tvs-block-activity-heatmap.js',
  },
  {
    ...config,
    entryPoints: ['src/blocks/manual-activity-tracker/view.js'],
    outfile: 'public/js/tvs-block-manual-activity-tracker.js',
  },
  {
    ...config,
    entryPoints: ['src/blocks/activity-stats-dashboard/view.js'],
    outfile: 'public/js/tvs-block-activity-stats-dashboard.js',
  },
  {
    ...config,
    entryPoints: ['src/blocks/single-activity-details/view.js'],
    outfile: 'public/js/tvs-block-single-activity-details.js',
  },
  {
    ...config,
    entryPoints: ['src/blocks/activity-timeline/view.js'],
    outfile: 'public/js/tvs-block-activity-timeline.js',
  },
  {
    ...config,
    entryPoints: ['src/blocks/activity-gallery/view.js'],
    outfile: 'public/js/tvs-block-activity-gallery.js',
  },
  {
    ...config,
    entryPoints: ['blocks/activity-comparison/view.js'],
    outfile: 'public/js/tvs-block-activity-comparison.js',
  },
  {
    ...config,
    entryPoints: ['blocks/manual-activity-tracker/index.js'],
    outfile: 'blocks/manual-activity-tracker/index.min.js',
    external: ['@wordpress/*'],
    loader: { '.js': 'jsx' },
  },
  {
    ...config,
    entryPoints: ['blocks/activity-timeline/index.js'],
    outfile: 'blocks/activity-timeline/index.min.js',
    external: ['@wordpress/*'],
    loader: { '.js': 'jsx' },
  },
];

async function build() {
  try {
    if (isWatch) {
      console.log('👀 Watching for changes...');
      const contexts = await Promise.all(
        builds.map(b => esbuild.context(b))
      );
      await Promise.all(contexts.map(ctx => ctx.watch()));
    } else {
      console.log(`🔨 Building ${isDev ? 'development' : 'production'}...`);
      await Promise.all(builds.map(b => esbuild.build(b)));
      console.log('✅ Build complete!');
    }
  } catch (err) {
    console.error('❌ Build failed:', err);
    process.exit(1);
  }
}

build();
