/**
 * People's Favourites Block - Editor Registration
 */
(function (wp) {
    const { registerBlockType } = wp.blocks;
    const { SelectControl, RangeControl, ToggleControl, PanelBody } = wp.components;
    const { InspectorControls } = wp.blockEditor;
    const { createElement: el } = wp.element;

    registerBlockType('tvs-virtual-sports/people-favourites', {
        edit: function (props) {
            const { attributes, setAttributes } = props;
            const { layout, columns, perPage, showPagination, showMeta, showBadges, showDifficulty, showCounts } = attributes;

            return el('div', { className: 'tvs-block-editor-wrapper' }, [
                el(InspectorControls, { key: 'inspector' }, [
                    el(PanelBody, { title: 'Layout Settings', initialOpen: true }, [
                        el(SelectControl, {
                            label: 'Layout',
                            value: layout,
                            options: [
                                { label: 'Grid', value: 'grid' },
                                { label: 'List', value: 'list' }
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
                            label: 'Routes Per Page',
                            value: perPage,
                            onChange: (value) => setAttributes({ perPage: value }),
                            min: 6,
                            max: 50
                        })
                    ]),
                    el(PanelBody, { title: 'Display Options', initialOpen: false }, [
                        el(ToggleControl, {
                            label: 'Show Pagination',
                            checked: showPagination,
                            onChange: (value) => setAttributes({ showPagination: value })
                        }),
                        el(ToggleControl, {
                            label: 'Show Meta (Distance, Elevation)',
                            checked: showMeta,
                            onChange: (value) => setAttributes({ showMeta: value })
                        }),
                        el(ToggleControl, {
                            label: 'Show Badges',
                            checked: showBadges,
                            onChange: (value) => setAttributes({ showBadges: value })
                        }),
                        el(ToggleControl, {
                            label: 'Show Difficulty',
                            checked: showDifficulty,
                            onChange: (value) => setAttributes({ showDifficulty: value })
                        }),
                        el(ToggleControl, {
                            label: 'Show Favourite Counts',
                            checked: showCounts,
                            onChange: (value) => setAttributes({ showCounts: value }),
                            help: 'Display number of users who favourited each route'
                        })
                    ])
                ]),
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
                    el('div', { style: { fontSize: '3rem', marginBottom: '1rem' } }, '⭐'),
                    el('h3', { style: { margin: '0 0 0.5rem 0' } }, "People's Favourites"),
                    el('p', { style: { margin: 0, color: '#6b7280' } }, 
                        `${layout.charAt(0).toUpperCase() + layout.slice(1)} layout • ${columns} columns • ${perPage} per page`
                    ),
                    showCounts && el('p', { style: { margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#9ca3af' } }, 
                        '❤️ Showing favourite counts'
                    )
                ])
            ]);
        },

        save: function () {
            return null; // Server-side rendered
        }
    });
})(window.wp);
