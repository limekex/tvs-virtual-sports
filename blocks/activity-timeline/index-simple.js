/**
 * Activity Timeline Block - Simplified Editor Registration
 */
(function() {
  const { registerBlockType } = wp.blocks;
  const { useBlockProps, InspectorControls } = wp.blockEditor;
  const { PanelBody, TextControl, RangeControl, ToggleControl } = wp.components;
  const { __ } = wp.i18n;
  const { createElement: el } = wp.element;

  registerBlockType('tvs-virtual-sports/activity-timeline', {
    edit: function(props) {
      const { attributes, setAttributes } = props;
      const blockProps = useBlockProps({
        className: 'tvs-activity-timeline-editor-preview',
      });

      const {
        title,
        limit,
        showNotes,
        userId,
        showFilters,
      } = attributes;

      return el('div', {},
        // Inspector Controls
        el(InspectorControls, {},
          el(PanelBody, { 
            title: __('Timeline Settings', 'tvs-virtual-sports'), 
            initialOpen: true 
          },
            el(TextControl, {
              label: __('Block Title', 'tvs-virtual-sports'),
              value: title,
              onChange: function(value) {
                setAttributes({ title: value });
              },
              help: __('Title displayed above the timeline', 'tvs-virtual-sports'),
            }),
            
            el(RangeControl, {
              label: __('Number of Activities', 'tvs-virtual-sports'),
              value: limit,
              onChange: function(value) {
                setAttributes({ limit: value });
              },
              min: 1,
              max: 50,
              help: __('Maximum number of activities to display', 'tvs-virtual-sports'),
            }),

            el(TextControl, {
              label: __('User ID', 'tvs-virtual-sports'),
              type: 'number',
              value: userId,
              onChange: function(value) {
                setAttributes({ userId: parseInt(value) || 0 });
              },
              help: __('Leave 0 for current logged-in user', 'tvs-virtual-sports'),
            }),

            el(ToggleControl, {
              label: __('Show Notes', 'tvs-virtual-sports'),
              checked: showNotes,
              onChange: function(value) {
                setAttributes({ showNotes: value });
              },
              help: __('Display activity notes with expand/collapse', 'tvs-virtual-sports'),
            }),

            el(ToggleControl, {
              label: __('Show Activity Type Filters', 'tvs-virtual-sports'),
              checked: showFilters,
              onChange: function(value) {
                setAttributes({ showFilters: value });
              },
              help: __('Show dropdown to filter activities by type', 'tvs-virtual-sports'),
            })
          )
        ),

        // Editor Preview
        el('div', blockProps,
          el('div', {
            style: {
              padding: '40px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'white',
            }
          },
            el('div', { 
              style: { 
                fontSize: '48px', 
                marginBottom: '16px' 
              } 
            }, '📅'),
            
            el('h3', { 
              style: { 
                margin: '0 0 8px 0', 
                color: 'white' 
              } 
            }, title || 'Activity Timeline'),
            
            el('p', {
              style: {
                margin: '0',
                opacity: 0.9,
                fontSize: '14px',
              }
            }, 
              'Showing ' + limit + ' activities' +
              (showNotes ? ' with notes' : '') +
              (showFilters ? ' • Filterable' : '')
            ),
            
            el('div', {
              style: {
                marginTop: '20px',
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                fontSize: '13px',
                display: 'inline-block',
              }
            }, '💡 Timeline will display on the frontend')
          )
        )
      );
    },

    save: function() {
      // Server-side rendered, return null
      return null;
    },
  });
})();
