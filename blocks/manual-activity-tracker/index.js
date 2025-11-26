/**
 * Manual Activity Tracker Block - Editor Registration
 * Issue #21: Treadmill/Indoor Activity Tracking
 */

import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, TextControl, ToggleControl, CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

registerBlockType('tvs-virtual-sports/manual-activity-tracker', {
  edit: ({ attributes, setAttributes }) => {
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

    return (
      <>
        <InspectorControls>
          <PanelBody title={__('Settings', 'tvs-virtual-sports')} initialOpen={true}>
            <TextControl
              label={__('Block Title', 'tvs-virtual-sports')}
              value={title}
              onChange={(value) => setAttributes({ title: value })}
            />
            
            <ToggleControl
              label={__('Show Type Selector', 'tvs-virtual-sports')}
              checked={showTypeSelector}
              onChange={(value) => setAttributes({ showTypeSelector: value })}
            />

            <TextControl
              label={__('Default Activity Type', 'tvs-virtual-sports')}
              value={defaultType}
              onChange={(value) => setAttributes({ defaultType: value })}
              help={__('Run, Ride, Walk, Hike, Swim, or Workout', 'tvs-virtual-sports')}
            />

            <ToggleControl
              label={__('Auto-start Activity', 'tvs-virtual-sports')}
              checked={autoStart}
              onChange={(value) => setAttributes({ autoStart: value })}
              help={__('Start tracking immediately when block loads', 'tvs-virtual-sports')}
            />

            <fieldset>
              <legend>{__('Allowed Activity Types', 'tvs-virtual-sports')}</legend>
              {allTypes.map((type) => (
                <CheckboxControl
                  key={type}
                  label={type}
                  checked={allowedTypes.includes(type)}
                  onChange={(checked) => {
                    if (checked) {
                      setAttributes({ allowedTypes: [...allowedTypes, type] });
                    } else {
                      setAttributes({
                        allowedTypes: allowedTypes.filter((t) => t !== type),
                      });
                    }
                  }}
                />
              ))}
            </fieldset>
          </PanelBody>
        </InspectorControls>

        <div {...blockProps}>
          <div className="tvs-manual-tracker-placeholder">
            <div className="placeholder-icon">▶️</div>
            <h3>{title || 'Manual Activity Tracker'}</h3>
            <p>
              {__('This block allows users to track manual indoor activities.', 'tvs-virtual-sports')}
            </p>
            <div className="placeholder-settings">
              <p>
                <strong>{__('Type Selector:', 'tvs-virtual-sports')}</strong>{' '}
                {showTypeSelector ? __('Enabled', 'tvs-virtual-sports') : __('Disabled', 'tvs-virtual-sports')}
              </p>
              <p>
                <strong>{__('Allowed Types:', 'tvs-virtual-sports')}</strong>{' '}
                {allowedTypes.join(', ')}
              </p>
              <p>
                <strong>{__('Default Type:', 'tvs-virtual-sports')}</strong> {defaultType}
              </p>
              {autoStart && (
                <p className="auto-start-notice">
                  ⚠️ {__('Auto-start is enabled', 'tvs-virtual-sports')}
                </p>
              )}
            </div>
          </div>
        </div>
      </>
    );
  },

  save: () => {
    // Server-side rendered block
    return null;
  },
});
