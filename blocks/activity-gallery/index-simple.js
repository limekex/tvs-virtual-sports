/**
 * Activity Gallery Block - Editor Registration
 */
(function (wp) {
    const { registerBlockType } = wp.blocks;
    const { SelectControl, RangeControl, ToggleControl, PanelBody } = wp.components;
    const { InspectorControls } = wp.blockEditor;
    const { createElement: el } = wp.element;

    registerBlockType('tvs-virtual-sports/activity-gallery', {
        edit: function (props) {
            const { attributes, setAttributes } = props;
            const { title, layout, columns, limit, showFilters } = attributes;

            return el('div', { className: 'tvs-block-editor-wrapper' }, [
                el(InspectorControls, { key: 'inspector' }, 
                    el(PanelBody, { title: 'Gallery Settings', initialOpen: true }, [
                        el(SelectControl, {
                            label: 'Layout',
                            value: layout,
                            options: [
                                { label: 'Grid', value: 'grid' },
                                { label: 'Masonry', value: 'masonry' }
                            ],
                            onChange: (value) => setAttributes({ layout: value })
                        }),
                        el(RangeControl, {
                            label: 'Columns',
                            value: columns,
                            onChange: (value) => setAttributes({ columns: value }),
                            min: 1,
                            max: 4
                        }),
                        el(RangeControl, {
                            label: 'Activities Per Page',
                            value: limit,
                            onChange: (value) => setAttributes({ limit: value }),
                            min: 6,
                            max: 50
                        }),
                        el(ToggleControl, {
                            label: 'Show Filters',
                            checked: showFilters,
                            onChange: (value) => setAttributes({ showFilters: value })
                        })
                    ])
                ),
                el('div', { 
                    key: 'preview',
                    className: 'tvs-block-editor-preview',
                    style: {
                        padding: '2rem',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        textAlign: 'center'
                    }
                }, [
                    el('div', { style: { fontSize: '3rem', marginBottom: '1rem' } }, '📸'),
                    el('h3', { style: { margin: '0 0 0.5rem 0' } }, 'Activity Gallery Block'),
                    el('p', { style: { margin: 0, color: '#6b7280' } }, 
                        `${layout.charAt(0).toUpperCase() + layout.slice(1)} layout • ${columns} columns • ${limit} activities`
                    )
                ])
            ]);
        },

        save: function () {
            return null; // Server-side rendered
        }
    });
})(window.wp);
