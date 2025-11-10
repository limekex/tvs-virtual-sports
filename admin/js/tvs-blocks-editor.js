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
