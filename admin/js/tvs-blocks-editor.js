(function(){
  var blocks = wp.blocks;
  var el = wp.element && wp.element.createElement;
  var hooks = wp.hooks;
  var compose = wp.compose;
  var components = wp.components;
  var blockEditor = wp.blockEditor || wp.editor;
  if (!blocks || !el) return;

  // Proactively unregister deprecated/placeholder variants so only a single block shows
  try { blocks.unregisterBlockType('tvs/my-activities'); } catch(e){}
  try { blocks.unregisterBlockType('tvs-virtual-sports/my-activities-legacy'); } catch(e){}

  function ensure(name, settings){
    if (!blocks.getBlockType(name)){
      blocks.registerBlockType(name, settings);
    }
  }

  // Keep lightweight placeholders so blocks appear in inserter if needed
  ensure('tvs-virtual-sports/invite-friends', {
    title: 'TVS Invite Friends',
    icon: 'share',
    category: 'widgets',
    keywords: ['tvs', 'invite', 'friends', 'codes'],
    edit: function(){
      return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Invite Friends');
    },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/my-activities', {
    title: 'TVS My Activities',
    icon: 'list-view',
    category: 'widgets',
    keywords: ['tvs', 'activities', 'routes'],
    edit: function(){
      return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS My Activities');
    },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/route-insights', {
    title: 'TVS Route Insights',
    icon: 'analytics',
    category: 'widgets',
    keywords: ['tvs', 'route', 'elevation', 'eta'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Route Insights'); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/personal-records', {
    title: 'TVS Personal Records',
    icon: 'awards',
    category: 'widgets',
    keywords: ['tvs', 'records', 'pace'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Personal Records'); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/activity-heatmap', {
    title: 'TVS Activity Heatmap',
    icon: 'chart-area',
    category: 'widgets',
    keywords: ['tvs', 'heatmap', 'sparkline'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Activity Heatmap'); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/route-weather', {
    title: 'TVS Route Weather',
    icon: 'cloud',
    category: 'widgets',
    keywords: ['tvs', 'weather', 'forecast', 'conditions'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Route Weather'); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/activity-stats-dashboard', {
    title: 'TVS Activity Stats Dashboard',
    icon: 'chart-bar',
    category: 'widgets',
    keywords: ['tvs', 'stats', 'dashboard', 'analytics', 'activities'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Activity Stats Dashboard'); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/single-activity-details', {
    title: 'TVS Activity Details',
    icon: 'analytics',
    category: 'widgets',
    keywords: ['tvs', 'activity', 'details', 'stats', 'single'],
    edit: function(){ 
      return el('div', { className: 'tvs-block-edit-placeholder' }, 
        'TVS Activity Details (auto-detects current activity)'
      ); 
    },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/manual-activity-tracker', {
    title: 'TVS Manual Activity Tracker',
    icon: 'edit',
    category: 'widgets',
    keywords: ['tvs', 'manual', 'activity', 'tracker', 'log'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Manual Activity Tracker'); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/activity-timeline', {
    title: 'TVS Activity Timeline',
    icon: 'backup',
    category: 'widgets',
    keywords: ['tvs', 'activity', 'timeline', 'history', 'progress'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Activity Timeline'); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/activity-gallery', {
    title: 'TVS Activity Gallery',
    icon: 'images-alt2',
    category: 'widgets',
    keywords: ['tvs', 'activity', 'gallery', 'grid', 'photos'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Activity Gallery'); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/my-favourites', {
    title: 'My Favourites',
    icon: 'heart',
    category: 'widgets',
    keywords: ['tvs', 'favourites', 'favorites', 'routes', 'saved'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'My Favourites'); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/people-favourites', {
    title: "People's Favourites",
    icon: 'star-filled',
    category: 'widgets',
    keywords: ['tvs', 'favourites', 'favorites', 'popular', 'top', 'routes'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, "People's Favourites"); },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/activity-comparison', {
    title: 'TVS Activity Comparison',
    icon: 'columns',
    category: 'widgets',
    keywords: ['tvs', 'activity', 'comparison', 'compare', 'performance', 'vs'],
    edit: function(){ return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Activity Comparison'); },
    save: function(){ return null; }
  });

  // ALWAYS show block attributes in the editor sidebar (InspectorControls)
  if (hooks && compose && blockEditor && components) {
    var InspectorControls = blockEditor.InspectorControls;
    var PanelBody = components.PanelBody;
    var RangeControl = components.RangeControl;
    var TextControl = components.TextControl;

    var withInspector = compose.createHigherOrderComponent(function(BlockEdit){
      return function(props){
        var attrs = props.attributes || {};
        var panels = [];

        if (props.name === 'tvs-virtual-sports/my-activities') {
          var limit = typeof attrs.limit === 'number' ? attrs.limit : 5;
          var routeId = typeof attrs.routeId === 'number' ? attrs.routeId : 0;
          var title = typeof attrs.title === 'string' ? attrs.title : '';
          panels.push(
            el(PanelBody, { title: 'My Activities Settings', initialOpen: true },
              el(TextControl, {
                label: 'Title', help: 'Custom heading shown above the list', value: title,
                onChange: function(val){ props.setAttributes({ title: val }); }
              }),
              el(RangeControl, {
                label: 'Number of items', min: 1, max: 20, step: 1, value: limit,
                onChange: function(val){ props.setAttributes({ limit: val }); }
              }),
              el(TextControl, {
                label: 'Route ID (optional)', help: 'Leave 0 to auto-detect on single route pages.', value: String(routeId || 0),
                onChange: function(val){ var n = parseInt(val, 10) || 0; props.setAttributes({ routeId: n }); }
              })
            )
          );
        }
        if (props.name === 'tvs-virtual-sports/route-insights') {
          panels.push(
            el(PanelBody, { title: 'Route Insights Settings', initialOpen: true },
              el(TextControl, { label: 'Title', value: attrs.title || '', onChange: function(val){ props.setAttributes({ title: val }); } }),
              el(TextControl, {
                label: 'Route ID (optional)',
                help: 'Leave 0 to auto-detect on single route pages.',
                value: String((typeof attrs.routeId==='number'?attrs.routeId:0) || 0),
                onChange: function(val){ var n = parseInt(val,10)||0; props.setAttributes({ routeId: n }); }
              }),
              el(components.ToggleControl, { label: 'Show elevation profile', checked: !!attrs.showElevation, onChange: function(v){ props.setAttributes({ showElevation: !!v }); } }),
              el(components.ToggleControl, { label: 'Show surface / terrain', checked: !!attrs.showSurface, onChange: function(v){ props.setAttributes({ showSurface: !!v }); } }),
              el(components.ToggleControl, { label: 'Show estimated time', checked: !!attrs.showEta, onChange: function(v){ props.setAttributes({ showEta: !!v }); } }),
              el(components.ToggleControl, { label: 'Show real-life map link', checked: !!attrs.showMapsLink, onChange: function(v){ props.setAttributes({ showMapsLink: !!v }); } })
            )
          );
        }
        if (props.name === 'tvs-virtual-sports/personal-records') {
          panels.push(
            el(PanelBody, { title: 'Personal Records Settings', initialOpen: true },
              el(TextControl, { label: 'Title', value: attrs.title || '', onChange: function(val){ props.setAttributes({ title: val }); } }),
              el(TextControl, {
                label: 'Route ID (optional)',
                help: 'Leave 0 to auto-detect on single route pages.',
                value: String((typeof attrs.routeId==='number'?attrs.routeId:0) || 0),
                onChange: function(val){ var n = parseInt(val,10)||0; props.setAttributes({ routeId: n }); }
              }),
              el(components.ToggleControl, { label: 'Show best time', checked: !!attrs.showBestTime, onChange: function(v){ props.setAttributes({ showBestTime: !!v }); } }),
              el(components.ToggleControl, { label: 'Show average pace', checked: !!attrs.showAvgPace, onChange: function(v){ props.setAttributes({ showAvgPace: !!v }); } }),
              el(components.ToggleControl, { label: 'Show average tempo', checked: !!attrs.showAvgTempo, onChange: function(v){ props.setAttributes({ showAvgTempo: !!v }); } }),
              el(components.ToggleControl, { label: 'Show most recent', checked: !!attrs.showMostRecent, onChange: function(v){ props.setAttributes({ showMostRecent: !!v }); } })
            )
          );
        }
        if (props.name === 'tvs-virtual-sports/activity-heatmap') {
          panels.push(
            el(PanelBody, { title: 'Activity Heatmap Settings', initialOpen: true },
              el(TextControl, { label: 'Title', value: attrs.title || '', onChange: function(val){ props.setAttributes({ title: val }); } }),
              el(components.SelectControl, {
                label: 'Type',
                value: attrs.heatmapType || 'sparkline',
                options: [
                  { label: 'Sparkline', value: 'sparkline' },
                  { label: 'Calendar (weekly)', value: 'calendar' }
                ],
                onChange: function(val){ props.setAttributes({ heatmapType: val }); }
              }),
              el(components.ToggleControl, { label: 'Vis distanse (km)', checked: !!attrs.showDistance, onChange: function(v){ props.setAttributes({ showDistance: !!v }); } }),
              el(components.ToggleControl, { label: 'Vis pace', checked: !!attrs.showPace, onChange: function(v){ props.setAttributes({ showPace: !!v }); } }),
              el(components.ToggleControl, { label: 'Vis kumulativ km', checked: !!attrs.showCumulative, onChange: function(v){ props.setAttributes({ showCumulative: !!v }); } }),
              el(TextControl, {
                label: 'Route ID (optional)',
                help: 'Leave 0 to include all of your activities.',
                value: String((typeof attrs.routeId==='number'?attrs.routeId:0) || 0),
                onChange: function(val){ var n = parseInt(val,10)||0; props.setAttributes({ routeId: n }); }
              })
            )
          );
        }
        if (props.name === 'tvs-virtual-sports/route-weather') {
          var maxDist = typeof attrs.maxDistance === 'number' ? attrs.maxDistance : 50;
          var debug = !!attrs.debug;
          panels.push(
            el(PanelBody, { title: 'Weather Settings', initialOpen: true },
              el(TextControl, { 
                label: 'Title', 
                value: attrs.title || 'Weather Conditions', 
                onChange: function(val){ props.setAttributes({ title: val }); } 
              }),
              el(RangeControl, {
                label: 'Max Distance (km)',
                help: 'Maximum distance to search for weather stations with complete data.',
                min: 10,
                max: 200,
                step: 10,
                value: maxDist,
                onChange: function(val){ props.setAttributes({ maxDistance: val }); }
              }),
              el(TextControl, {
                label: 'Route ID (optional)',
                help: 'Leave 0 to auto-detect on single route pages.',
                value: String((typeof attrs.routeId==='number'?attrs.routeId:0) || 0),
                onChange: function(val){ var n = parseInt(val,10)||0; props.setAttributes({ routeId: n }); }
              }),
              el(components.ToggleControl, { 
                label: 'Debug Mode', 
                help: 'Show raw weather data and API responses.',
                checked: debug, 
                onChange: function(v){ props.setAttributes({ debug: !!v }); } 
              })
            )
          );
        }
        if (props.name === 'tvs-virtual-sports/activity-stats-dashboard') {
          var userId = typeof attrs.userId === 'number' ? attrs.userId : 0;
          var period = typeof attrs.period === 'string' ? attrs.period : '30d';
          var showCharts = typeof attrs.showCharts === 'boolean' ? attrs.showCharts : true;
          panels.push(
            el(PanelBody, { title: 'Dashboard Settings', initialOpen: true },
              el(TextControl, {
                label: 'Title',
                value: attrs.title || 'Activity Dashboard',
                onChange: function(val){ props.setAttributes({ title: val }); }
              }),
              el(components.SelectControl, {
                label: 'Default Period',
                value: period,
                options: [
                  { label: '7 Days', value: '7d' },
                  { label: '30 Days', value: '30d' },
                  { label: '90 Days', value: '90d' },
                  { label: 'All Time', value: 'all' }
                ],
                onChange: function(val){ props.setAttributes({ period: val }); }
              }),
              el(TextControl, {
                label: 'User ID (optional)',
                help: 'Leave 0 for current logged-in user.',
                value: String(userId || 0),
                onChange: function(val){ var n = parseInt(val, 10) || 0; props.setAttributes({ userId: n }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Charts',
                help: 'Display activity type breakdown chart.',
                checked: showCharts,
                onChange: function(v){ props.setAttributes({ showCharts: !!v }); }
              })
            )
          );
        }
        if (props.name === 'tvs-virtual-sports/single-activity-details') {
          var activityId = typeof attrs.activityId === 'number' ? attrs.activityId : 0;
          var showComparison = typeof attrs.showComparison === 'boolean' ? attrs.showComparison : true;
          var showActions = typeof attrs.showActions === 'boolean' ? attrs.showActions : true;
          var showNotes = typeof attrs.showNotes === 'boolean' ? attrs.showNotes : true;
          panels.push(
            el(PanelBody, { title: 'Activity Details Settings', initialOpen: true },
              el(TextControl, {
                label: 'Activity ID (optional)',
                help: 'Leave 0 to auto-detect from current page context.',
                value: String(activityId || 0),
                onChange: function(val){ var n = parseInt(val, 10) || 0; props.setAttributes({ activityId: n }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Comparison',
                help: 'Compare with personal best and previous attempts.',
                checked: showComparison,
                onChange: function(v){ props.setAttributes({ showComparison: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Actions',
                help: 'Display edit/delete buttons for activity author.',
                checked: showActions,
                onChange: function(v){ props.setAttributes({ showActions: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Notes',
                help: 'Display activity notes if available.',
                checked: showNotes,
                onChange: function(v){ props.setAttributes({ showNotes: !!v }); }
              })
            )
          );
        }
        if (props.name === 'tvs-virtual-sports/activity-timeline') {
          var limit = typeof attrs.limit === 'number' ? attrs.limit : 10;
          var userId = typeof attrs.userId === 'number' ? attrs.userId : 0;
          var showNotes = typeof attrs.showNotes === 'boolean' ? attrs.showNotes : true;
          var showFilters = typeof attrs.showFilters === 'boolean' ? attrs.showFilters : false;
          panels.push(
            el(PanelBody, { title: 'Timeline Settings', initialOpen: true },
              el(TextControl, {
                label: 'Title',
                value: attrs.title || 'Activity Timeline',
                onChange: function(val){ props.setAttributes({ title: val }); }
              }),
              el(RangeControl, {
                label: 'Number of Activities',
                min: 1,
                max: 50,
                step: 1,
                value: limit,
                onChange: function(val){ props.setAttributes({ limit: val }); }
              }),
              el(TextControl, {
                label: 'User ID (optional)',
                help: 'Leave 0 for current logged-in user.',
                value: String(userId || 0),
                onChange: function(val){ var n = parseInt(val, 10) || 0; props.setAttributes({ userId: n }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Notes',
                help: 'Display activity notes with expand/collapse.',
                checked: showNotes,
                onChange: function(v){ props.setAttributes({ showNotes: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Activity Type Filters',
                help: 'Show dropdown to filter activities by type.',
                checked: showFilters,
                onChange: function(v){ props.setAttributes({ showFilters: !!v }); }
              })
            )
          );
        }

        if (props.name === 'tvs-virtual-sports/my-favourites') {
          var layout = typeof attrs.layout === 'string' ? attrs.layout : 'grid';
          var columns = typeof attrs.columns === 'number' ? attrs.columns : 3;
          var perPage = typeof attrs.perPage === 'number' ? attrs.perPage : 12;
          var showPagination = typeof attrs.showPagination === 'boolean' ? attrs.showPagination : true;
          var showMeta = typeof attrs.showMeta === 'boolean' ? attrs.showMeta : true;
          var showBadges = typeof attrs.showBadges === 'boolean' ? attrs.showBadges : true;
          var showDifficulty = typeof attrs.showDifficulty === 'boolean' ? attrs.showDifficulty : true;
          var emptyStateText = typeof attrs.emptyStateText === 'string' ? attrs.emptyStateText : 'No favourites yet. Start exploring routes to add some!';
          panels.push(
            el(PanelBody, { title: 'My Favourites Settings', initialOpen: true },
              el(components.SelectControl, {
                label: 'Layout',
                value: layout,
                options: [
                  { label: 'Grid', value: 'grid' },
                  { label: 'List', value: 'list' }
                ],
                onChange: function(val){ props.setAttributes({ layout: val }); }
              }),
              el(RangeControl, {
                label: 'Columns',
                min: 1,
                max: 4,
                step: 1,
                value: columns,
                onChange: function(val){ props.setAttributes({ columns: val }); }
              }),
              el(RangeControl, {
                label: 'Routes Per Page',
                min: 6,
                max: 50,
                step: 1,
                value: perPage,
                onChange: function(val){ props.setAttributes({ perPage: val }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Pagination',
                checked: showPagination,
                onChange: function(v){ props.setAttributes({ showPagination: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Meta (Distance, Elevation)',
                checked: showMeta,
                onChange: function(v){ props.setAttributes({ showMeta: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Badges',
                checked: showBadges,
                onChange: function(v){ props.setAttributes({ showBadges: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Difficulty',
                checked: showDifficulty,
                onChange: function(v){ props.setAttributes({ showDifficulty: !!v }); }
              }),
              el(TextControl, {
                label: 'Empty State Text',
                help: 'Message shown when user has no favourites.',
                value: emptyStateText,
                onChange: function(val){ props.setAttributes({ emptyStateText: val }); }
              })
            )
          );
        }

        if (props.name === 'tvs-virtual-sports/people-favourites') {
          var layout = typeof attrs.layout === 'string' ? attrs.layout : 'grid';
          var columns = typeof attrs.columns === 'number' ? attrs.columns : 3;
          var perPage = typeof attrs.perPage === 'number' ? attrs.perPage : 12;
          var showPagination = typeof attrs.showPagination === 'boolean' ? attrs.showPagination : true;
          var showMeta = typeof attrs.showMeta === 'boolean' ? attrs.showMeta : true;
          var showBadges = typeof attrs.showBadges === 'boolean' ? attrs.showBadges : true;
          var showDifficulty = typeof attrs.showDifficulty === 'boolean' ? attrs.showDifficulty : true;
          var showCounts = typeof attrs.showCounts === 'boolean' ? attrs.showCounts : true;
          panels.push(
            el(PanelBody, { title: "People's Favourites Settings", initialOpen: true },
              el(components.SelectControl, {
                label: 'Layout',
                value: layout,
                options: [
                  { label: 'Grid', value: 'grid' },
                  { label: 'List', value: 'list' }
                ],
                onChange: function(val){ props.setAttributes({ layout: val }); }
              }),
              el(RangeControl, {
                label: 'Columns',
                min: 1,
                max: 4,
                step: 1,
                value: columns,
                onChange: function(val){ props.setAttributes({ columns: val }); }
              }),
              el(RangeControl, {
                label: 'Routes Per Page',
                min: 6,
                max: 50,
                step: 1,
                value: perPage,
                onChange: function(val){ props.setAttributes({ perPage: val }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Pagination',
                checked: showPagination,
                onChange: function(v){ props.setAttributes({ showPagination: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Meta (Distance, Elevation)',
                checked: showMeta,
                onChange: function(v){ props.setAttributes({ showMeta: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Badges',
                checked: showBadges,
                onChange: function(v){ props.setAttributes({ showBadges: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Difficulty',
                checked: showDifficulty,
                onChange: function(v){ props.setAttributes({ showDifficulty: !!v }); }
              }),
              el(components.ToggleControl, {
                label: 'Show Favourite Counts',
                help: 'Display number of users who favourited each route.',
                checked: showCounts,
                onChange: function(v){ props.setAttributes({ showCounts: !!v }); }
              })
            )
          );
        }

        if (props.name === 'tvs-virtual-sports/activity-comparison') {
          var mode = typeof attrs.mode === 'string' ? attrs.mode : 'manual';
          var activityId1 = typeof attrs.activityId1 === 'number' ? attrs.activityId1 : 0;
          var activityId2 = typeof attrs.activityId2 === 'number' ? attrs.activityId2 : 0;
          var routeId = typeof attrs.routeId === 'number' ? attrs.routeId : 0;
          var userId = typeof attrs.userId === 'number' ? attrs.userId : 0;
          panels.push(
            el(PanelBody, { title: 'Comparison Settings', initialOpen: true },
              el(TextControl, {
                label: 'Title',
                value: attrs.title || 'Activity Comparison',
                onChange: function(val){ props.setAttributes({ title: val }); }
              }),
              el(components.SelectControl, {
                label: 'Comparison Mode',
                value: mode,
                options: [
                  { label: 'Manual Selection', value: 'manual' },
                  { label: 'Latest vs Personal Best', value: 'vs-best' },
                  { label: 'Latest vs Previous on Route', value: 'vs-previous' }
                ],
                onChange: function(val){ props.setAttributes({ mode: val }); }
              }),
              mode === 'manual' && el(TextControl, {
                label: 'Activity ID 1',
                help: 'First activity to compare.',
                value: String(activityId1 || 0),
                onChange: function(val){ var n = parseInt(val, 10) || 0; props.setAttributes({ activityId1: n }); }
              }),
              mode === 'manual' && el(TextControl, {
                label: 'Activity ID 2',
                help: 'Second activity to compare.',
                value: String(activityId2 || 0),
                onChange: function(val){ var n = parseInt(val, 10) || 0; props.setAttributes({ activityId2: n }); }
              }),
              mode === 'vs-previous' && el(TextControl, {
                label: 'Route ID',
                help: 'Route to compare activities on.',
                value: String(routeId || 0),
                onChange: function(val){ var n = parseInt(val, 10) || 0; props.setAttributes({ routeId: n }); }
              }),
              el(TextControl, {
                label: 'User ID (optional)',
                help: 'Leave 0 for current logged-in user.',
                value: String(userId || 0),
                onChange: function(val){ var n = parseInt(val, 10) || 0; props.setAttributes({ userId: n }); }
              })
            )
          );
        }

        if (!panels.length) return el(BlockEdit, props);
        return el(wp.element.Fragment, null,
          el(BlockEdit, props),
          el(InspectorControls, null, panels)
        );
      };
    }, 'withTVSMyActivitiesInspector');

    hooks.addFilter('editor.BlockEdit', 'tvs/my-activities/inspector', withInspector);
  }
})();
