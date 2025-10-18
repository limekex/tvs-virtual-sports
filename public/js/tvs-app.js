(function(){
    // Minimal React app (uses React and ReactDOM from CDN)
    var e = window.React.createElement;
    function App(props){
        var route = props.route || null;
        if(!route){
            return e('div', null, 'Route data not available.');
        }

        function createActivity(){
            var payload = {
                route_id: route.id,
                started_at: new Date().toISOString(),
                duration_s: route.meta.duration_s || 0,
                distance_m: route.meta.distance_m || 0,
            };
            fetch( '/wp-json/tvs/v1/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify( payload )
            } ).then(function(r){ return r.json(); }).then(function(data){
                console.log('Create activity response', data);
                alert('Activity created: ' + (data.id || JSON.stringify(data)) );
            }).catch(function(err){
                console.error(err);
                alert('Failed to create activity');
            });
        }

        return e('div', { className: 'tvs-route' },
            e('h2', null, route.title ),
            route.meta && route.meta.vimeo_id ?
                e('div', { className: 'tvs-video' }, e('iframe', { width: '560', height: '315', src: 'https://player.vimeo.com/video/' + encodeURIComponent(route.meta.vimeo_id), frameBorder: 0, allow: 'autoplay; fullscreen', allowFullScreen: true }))
                : null,
            e('div', { className: 'tvs-meta' }, e('pre', null, JSON.stringify(route.meta, null, 2) ) ),
            e('button', { onClick: createActivity }, 'Start activity')
        );
    }

    document.addEventListener('DOMContentLoaded', function(){
        var root = document.getElementById('tvs-app-root');
        if(!root){ return; }
        var payload = window.tvs_route_payload || null;
        window.ReactDOM.createRoot(root).render( e(App, { route: payload } ) );
    });
})();
