/**
 * Activity Timeline Block - Editor Registration
 * Displays user activities in reverse chronological timeline view
 */

import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, TextControl, RangeControl, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

registerBlockType('tvs-virtual-sports/activity-timeline', {
  edit: ({ attributes, setAttributes }) => {
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

    return (
      <>
        <InspectorControls>
          <PanelBody title={__('Timeline Settings', 'tvs-virtual-sports')} initialOpen={true}>
            <TextControl
              label={__('Block Title', 'tvs-virtual-sports')}
              value={title}
              onChange={(value) => setAttributes({ title: value })}
              help={__('Title displayed above the timeline', 'tvs-virtual-sports')}
            />
            
            <RangeControl
              label={__('Number of Activities', 'tvs-virtual-sports')}
              value={limit}
              onChange={(value) => setAttributes({ limit: value })}
              min={1}
              max={50}
              help={__('Maximum number of activities to display', 'tvs-virtual-sports')}
            />

            <TextControl
              label={__('User ID', 'tvs-virtual-sports')}
              type="number"
              value={userId}
              onChange={(value) => setAttributes({ userId: parseInt(value) || 0 })}
              help={__('Leave 0 for current logged-in user', 'tvs-virtual-sports')}
            />

            <ToggleControl
              label={__('Show Notes', 'tvs-virtual-sports')}
              checked={showNotes}
              onChange={(value) => setAttributes({ showNotes: value })}
              help={__('Display activity notes with expand/collapse', 'tvs-virtual-sports')}
            />

            <ToggleControl
              label={__('Show Activity Type Filters', 'tvs-virtual-sports')}
              checked={showFilters}
              onChange={(value) => setAttributes({ showFilters: value })}
              help={__('Show dropdown to filter activities by type', 'tvs-virtual-sports')}
            />
          </PanelBody>
        </InspectorControls>

        <div {...blockProps}>
          <div style={{
            padding: '40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            textAlign: 'center',
            color: 'white',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
            <h3 style={{ margin: '0 0 8px 0', color: 'white' }}>
              {title || 'Activity Timeline'}
            </h3>
            <p style={{ 
              margin: '0',
              opacity: 0.9,
              fontSize: '14px',
            }}>
              Showing {limit} activities
              {showNotes && ' with notes'}
              {showFilters && ' • Filterable'}
            </p>
            <div style={{
              marginTop: '20px',
              padding: '12px 24px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              fontSize: '13px',
              display: 'inline-block',
            }}>
              💡 Timeline will display on the frontend
            </div>
          </div>
        </div>
      </>
    );
  },

  save: () => {
    // Server-side rendered, return null
    return null;
  },
});
