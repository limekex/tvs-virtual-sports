import { registerBlockType } from '@wordpress/blocks';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { PanelBody, SelectControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

registerBlockType('tvs-virtual-sports/activity-comparison', {
    edit: ({ attributes, setAttributes }) => {
        const blockProps = useBlockProps();
        const { title, mode, activityId1, activityId2, routeId, userId } = attributes;

        return (
            <>
                <InspectorControls>
                    <PanelBody title={__('Comparison Settings', 'tvs-virtual-sports')}>
                        <TextControl
                            label={__('Title', 'tvs-virtual-sports')}
                            value={title}
                            onChange={(value) => setAttributes({ title: value })}
                        />
                        <SelectControl
                            label={__('Comparison Mode', 'tvs-virtual-sports')}
                            value={mode}
                            options={[
                                { label: __('Manual Selection', 'tvs-virtual-sports'), value: 'manual' },
                                { label: __('Latest vs Personal Best', 'tvs-virtual-sports'), value: 'vs-best' },
                                { label: __('Latest vs Previous on Route', 'tvs-virtual-sports'), value: 'vs-previous' }
                            ]}
                            onChange={(value) => setAttributes({ mode: value })}
                        />
                        {mode === 'manual' && (
                            <>
                                <TextControl
                                    label={__('Activity ID 1', 'tvs-virtual-sports')}
                                    type="number"
                                    value={activityId1}
                                    onChange={(value) => setAttributes({ activityId1: parseInt(value) || 0 })}
                                />
                                <TextControl
                                    label={__('Activity ID 2', 'tvs-virtual-sports')}
                                    type="number"
                                    value={activityId2}
                                    onChange={(value) => setAttributes({ activityId2: parseInt(value) || 0 })}
                                />
                            </>
                        )}
                        {mode === 'vs-previous' && (
                            <TextControl
                                label={__('Route ID', 'tvs-virtual-sports')}
                                type="number"
                                value={routeId}
                                onChange={(value) => setAttributes({ routeId: parseInt(value) || 0 })}
                            />
                        )}
                        <TextControl
                            label={__('User ID (0 = current user)', 'tvs-virtual-sports')}
                            type="number"
                            value={userId}
                            onChange={(value) => setAttributes({ userId: parseInt(value) || 0 })}
                        />
                    </PanelBody>
                </InspectorControls>

                <div {...blockProps}>
                    <div className="tvs-comparison-placeholder">
                        <h3>{title}</h3>
                        <p>
                            {mode === 'manual' && __('Comparing activity #', 'tvs-virtual-sports') + activityId1 + __(' with #', 'tvs-virtual-sports') + activityId2}
                            {mode === 'vs-best' && __('Latest activity vs. Personal Best', 'tvs-virtual-sports')}
                            {mode === 'vs-previous' && __('Latest vs. Previous on Route #', 'tvs-virtual-sports') + routeId}
                        </p>
                        <p style={{ fontSize: '0.9em', color: '#666' }}>
                            {__('Preview available on frontend', 'tvs-virtual-sports')}
                        </p>
                    </div>
                </div>
            </>
        );
    },
    save: () => null // Server-rendered block
});
