(function($){
    $(function(){
        // Enhance admin UX for meta fields
        console.log('TVS admin ready');

        // Convert some meta inputs to number/date types for better UX
        $('input[id^="tvs_route_meta_distance_m"]').attr('type','number').attr('min',0);
        $('input[id^="tvs_route_meta_elevation_m"]').attr('type','number');
        $('input[id^="tvs_route_meta_duration_s"]').attr('type','number');

        // Activity meta fields
        $('input[id^="tvs_activity_meta_started_at"]').attr('type','datetime-local');
        $('input[id^="tvs_activity_meta_ended_at"]').attr('type','datetime-local');
        $('input[id^="tvs_activity_meta_duration_s"]').attr('type','number');

        // Simple client-side validation when saving
        $('#post').on('submit', function(e){
            // Example: ensure duration is positive if present
            var dur = $('input[id^="tvs_activity_meta_duration_s"]').val();
            if ( dur && parseFloat(dur) < 0 ) {
                alert('Duration must be a positive number');
                e.preventDefault();
                return false;
            }
            return true;
        });
    });
})(jQuery);
