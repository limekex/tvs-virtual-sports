/**
 * Manual Activity Tracker Block - Simplified Editor Registration
 */
(function() {
  const { registerBlockType } = wp.blocks;
  const { useBlockProps, InspectorControls } = wp.blockEditor;
  const { PanelBody, TextControl, ToggleControl, CheckboxControl } = wp.components;
  const { __ } = wp.i18n;
  const { createElement: el } = wp.element;

  registerBlockType('tvs-virtual-sports/manual-activity-tracker', {
    edit: function(props) {
      const { attributes, setAttributes } = props;
      const blockProps = useBlockProps({
        className: 'tvs-manual-tracker-editor-preview',
      });

      const {
        title,
        showTypeSelector,
        allowedTypes,
        autoStart,
        defaultType,
      } = attributes;

      const allTypes = ['Run', 'Ride', 'Walk', 'Hike', 'Swim', 'Workout'];

      return el('div', {},
        // Inspector Controls
        el(InspectorControls, {},
          el(PanelBody, { title: __('Settings', 'tvs-virtual-sports'), initialOpen: true },
            el(TextControl, {
              label: __('Block Title', 'tvs-virtual-sports'),
              value: title,
              onChange: function(value) { setAttributes({ title: value }); }
            }),
            el(ToggleControl, {
              label: __('Show Type Selector', 'tvs-virtual-sports'),
              checked: showTypeSelector,
              onChange: function(value) { setAttributes({ showTypeSelector: value }); }
            }),
            el(TextControl, {
              label: __('Default Activity Type', 'tvs-virtual-sports'),
              value: defaultType,
              onChange: function(value) { setAttributes({ defaultType: value }); },
              help: __('Run, Ride, Walk, Hike, Swim, or Workout', 'tvs-virtual-sports')
            }),
            el(ToggleControl, {
              label: __('Auto-start Activity', 'tvs-virtual-sports'),
              checked: autoStart,
              onChange: function(value) { setAttributes({ autoStart: value }); },
              help: __('Start tracking immediately when block loads', 'tvs-virtual-sports')
            })
          )
        ),
        // Block preview
        el('div', blockProps,
          el('div', { 
            className: 'tvs-manual-tracker-placeholder',
            style: {
              padding: '40px',
              textAlign: 'center',
              background: '#f5f5f5',
              borderRadius: '8px',
              border: '2px dashed #ccc'
            }
          },
            el('div', { style: { fontSize: '48px', marginBottom: '16px' } }, '▶️'),
            el('h3', { style: { margin: '0 0 16px 0' } }, title || 'Manual Activity Tracker'),
            el('p', { style: { color: '#666' } }, 
              __('This block allows users to track manual indoor activities.', 'tvs-virtual-sports')
            ),
            el('div', { 
              style: { 
                marginTop: '24px', 
                padding: '16px', 
                background: '#fff',
                borderRadius: '4px'
              }
            },
              el('p', { style: { margin: '8px 0' } },
                el('strong', {}, __('Type Selector: ', 'tvs-virtual-sports')),
                showTypeSelector ? __('Enabled', 'tvs-virtual-sports') : __('Disabled', 'tvs-virtual-sports')
              ),
              el('p', { style: { margin: '8px 0' } },
                el('strong', {}, __('Default Type: ', 'tvs-virtual-sports')),
                defaultType
              ),
              autoStart && el('p', { 
                style: { 
                  margin: '8px 0', 
                  color: '#f57c00',
                  fontWeight: 'bold'
                }
              }, '⚠️ ' + __('Auto-start is enabled', 'tvs-virtual-sports'))
            )
          )
        )
      );
    },

    save: function() {
      return null; // Server-side rendered
    }
  });
})();
