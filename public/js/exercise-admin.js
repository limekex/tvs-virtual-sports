/**
 * Exercise Admin - Media Uploader
 */
(function($) {
    'use strict';

    $(document).ready(function() {
        let mediaUploader;

        // Handle upload button click
        $('.tvs-upload-media-btn').on('click', function(e) {
            e.preventDefault();
            
            const button = $(this);
            const targetInput = $('#' + button.data('target'));

            // If the media uploader already exists, reopen it
            if (mediaUploader) {
                mediaUploader.open();
                return;
            }

            // Create a new media uploader
            mediaUploader = wp.media({
                title: 'Select or Upload Animation/GIF',
                button: {
                    text: 'Use this file'
                },
                multiple: false,
                library: {
                    type: ['image', 'image/gif']
                }
            });

            // When a file is selected, grab the URL and set it as the input value
            mediaUploader.on('select', function() {
                const attachment = mediaUploader.state().get('selection').first().toJSON();
                targetInput.val(attachment.url);
                
                // Show preview
                const previewContainer = targetInput.closest('p').next('p');
                if (previewContainer.find('img').length) {
                    previewContainer.find('img').attr('src', attachment.url);
                } else {
                    targetInput.closest('p').after(
                        '<p style="margin-top: 10px;"><strong>Preview:</strong><br>' +
                        '<img src="' + attachment.url + '" style="max-width: 200px; height: auto; border: 1px solid #ddd; padding: 4px; background: #f9f9f9;"></p>'
                    );
                }
            });

            // Open the uploader
            mediaUploader.open();
        });
    });
})(jQuery);
