import { createRoot } from 'react-dom/client';
import React, { useEffect, useState } from 'react';
import DevOverlay from './dev-overlay';

function VirtualRouteApp({ routeId }) {
	const [data, setData] = useState(null);

	useEffect(() => {
		fetch(`/wp-json/tvs/v1/routes/${routeId}`)
			.then((res) => res.json())
			.then(setData)
			.catch(console.error);
	}, [routeId]);

	if (!data) return <p>Loading route data...</p>;

	return (
		<div className="tvs-app">
			<h2>{data.title?.rendered}</h2>
			<p>
				Distance: {data.meta?.distance_m} m – Elevation:{' '}
				{data.meta?.elevation_m} m
			</p>
			<video src={data.meta?.video_url} controls width="100%" />
		</div>
	);
}

// mount app if div[data-route-id] exists
document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('.tvs-app-root').forEach((el) => {
		const routeId = el.dataset.routeId;
		if (routeId) createRoot(el).render(<VirtualRouteApp routeId={routeId} />);
	});
});
