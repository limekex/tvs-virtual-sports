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

  // ALWAYS show block attributes in the editor sidebar (InspectorControls)
  if (hooks && compose && blockEditor && components) {
    var InspectorControls = blockEditor.InspectorControls;
    var PanelBody = components.PanelBody;
    var RangeControl = components.RangeControl;
    var TextControl = components.TextControl;

    var withInspector = compose.createHigherOrderComponent(function(BlockEdit){
      return function(props){
        if (props.name !== 'tvs-virtual-sports/my-activities') {
          return el(BlockEdit, props);
        }
        var attrs = props.attributes || {};
        var limit = typeof attrs.limit === 'number' ? attrs.limit : 5;
        var routeId = typeof attrs.routeId === 'number' ? attrs.routeId : 0;
        var title = typeof attrs.title === 'string' ? attrs.title : '';

        return el(
          wp.element.Fragment,
          null,
          el(BlockEdit, props),
          el(InspectorControls, {},
            el(PanelBody, { title: 'My Activities Settings', initialOpen: true },
              el(TextControl, {
                label: 'Title',
                help: 'Custom heading shown above the list',
                value: title,
                onChange: function(val){ props.setAttributes({ title: val }); }
              }),
              el(RangeControl, {
                label: 'Number of items',
                min: 1,
                max: 20,
                step: 1,
                value: limit,
                onChange: function(val){ props.setAttributes({ limit: val }); }
              }),
              el(TextControl, {
                label: 'Route ID (optional)',
                help: 'Leave 0 to auto-detect on single route pages.',
                value: String(routeId || 0),
                onChange: function(val){ var n = parseInt(val, 10) || 0; props.setAttributes({ routeId: n }); }
              })
            )
          )
        );
      };
    }, 'withTVSMyActivitiesInspector');

    hooks.addFilter('editor.BlockEdit', 'tvs/my-activities/inspector', withInspector);
  }
})();
