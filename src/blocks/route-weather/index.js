/**
 * Route Weather Block Editor
 */
import { registerBlockType } from '@wordpress/blocks';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody, RangeControl, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useBlockProps } from '@wordpress/block-editor';
import ServerSideRender from '@wordpress/server-side-render';

registerBlockType('tvs-virtual-sports/route-weather', {
    edit: ({ attributes, setAttributes }) => {
        const blockProps = useBlockProps();
        const { maxDistance, debug } = attributes;

        return (
            <>
                <InspectorControls>
                    <PanelBody title={__('Weather Settings', 'tvs-virtual-sports')} initialOpen={true}>
                        <RangeControl
                            label={__('Max Distance (km)', 'tvs-virtual-sports')}
                            help={__(
                                'Maximum distance to search for weather stations with complete data. Closer stations are more accurate but may lack weather codes.',
                                'tvs-virtual-sports'
                            )}
                            value={maxDistance}
                            onChange={(value) => setAttributes({ maxDistance: value })}
                            min={10}
                            max={200}
                            step={10}
                        />
                        <ToggleControl
                            label={__('Debug Mode', 'tvs-virtual-sports')}
                            help={__('Show raw weather data and API responses.', 'tvs-virtual-sports')}
                            checked={debug}
                            onChange={(value) => setAttributes({ debug: value })}
                        />
                    </PanelBody>
                </InspectorControls>
                <div {...blockProps}>
                    <ServerSideRender
                        block="tvs-virtual-sports/route-weather"
                        attributes={attributes}
                    />
                </div>
            </>
        );
    },
    save: () => null // Server-side rendered
});
