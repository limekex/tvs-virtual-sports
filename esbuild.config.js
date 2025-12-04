// esbuild configuration for TVS Virtual Sports
// Maps React imports to window.React global

const globalExternals = {
  'react': 'window.React',
  'react-dom': 'window.ReactDOM'
};

const globalExternalsPlugin = {
  name: 'global-externals',
  setup(build) {
    // Mark react and react-dom as external
    const filter = /^(react|react-dom)$/;
    
    build.onResolve({ filter }, args => ({
      path: args.path,
      namespace: 'global-externals'
    }));
    
    build.onLoad({ filter: /.*/, namespace: 'global-externals' }, args => ({
      contents: `module.exports = ${globalExternals[args.path]};`
    }));
  }
};

module.exports = { globalExternalsPlugin };
