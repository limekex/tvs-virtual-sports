import React, { useEffect, useRef, useState } from 'react';

function useFPS() {
	const [fps, setFps] = useState(0);
	const lastTime = useRef(performance.now());
	const frames = useRef(0);

	useEffect(() => {
		let raf;
		const tick = (t) => {
			frames.current += 1;
			if (t - lastTime.current >= 1000) {
				setFps(frames.current);
				frames.current = 0;
				lastTime.current = t;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);
	return fps;
}

export default function DevOverlay({ routeId, lastStatus, lastError }) {
	const fps = useFPS();
	const boxRef = useRef(null);
	const [min, setMin] = useState(false);
	const [pos, setPos] = useState({ x: 16, y: 16 });

	// drag
	useEffect(() => {
		const el = boxRef.current;
		if (!el) return;
		let sx, sy, ox, oy, moving = false;

		function onDown(e) {
			const target = e.target.closest('.tvs-dev__header');
			if (!target) return;
			moving = true;
			sx = e.clientX; sy = e.clientY;
			ox = pos.x; oy = pos.y;
			e.preventDefault();
		}
		function onMove(e) {
			if (!moving) return;
			setPos({ x: ox + (e.clientX - sx), y: oy + (e.clientY - sy) });
		}
		function onUp() { moving = false; }

		window.addEventListener('mousedown', onDown);
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		return () => {
			window.removeEventListener('mousedown', onDown);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
	}, [pos]);

	const data = {
		env: window.TVS_SETTINGS?.env,
		version: window.TVS_SETTINGS?.version,
		restRoot: window.TVS_SETTINGS?.restRoot,
		user: window.TVS_SETTINGS?.user,
		routeId,
		lastStatus,
		lastError: lastError ? String(lastError) : null,
		time: new Date().toISOString(),
	};

	function copy() {
		navigator.clipboard.writeText(JSON.stringify(data, null, 2))
			.catch(console.error);
	}

	return (
		<div
			ref={boxRef}
			className={`tvs-dev ${min ? 'is-min' : ''}`}
			style={{ left: pos.x, top: pos.y }}
		>
			<div className="tvs-dev__header">
				<strong>TVS Dev</strong>
				<div className="tvs-dev__spacer" />
				<span className="tvs-dev__pill">{data.env}</span>
				<button className="tvs-dev__btn" onClick={() => setMin(!min)} aria-label="Minimize">▁</button>
			</div>

			<div className="tvs-dev__body">
				<div className="tvs-dev__row"><span>Route</span><code>{data.routeId ?? 'n/a'}</code></div>
				<div className="tvs-dev__row"><span>User</span><code>{data.user ?? 'guest'}</code></div>
				<div className="tvs-dev__row"><span>REST</span><code>{data.restRoot}</code></div>
				<div className="tvs-dev__row"><span>Status</span><code>{data.lastStatus ?? 'idle'}</code></div>
				{data.lastError && (
					<div className="tvs-dev__row"><span>Error</span><code className="tvs-dev__err">{data.lastError}</code></div>
				)}
				<div className="tvs-dev__row"><span>FPS</span><code>{fps}</code></div>
				<div className="tvs-dev__actions">
					<button onClick={copy} className="tvs-dev__btn">Copy debug</button>
					<button onClick={() => { localStorage.setItem('tvsDev','0'); location.reload(); }} className="tvs-dev__btn tvs-dev__btn--ghost">Disable</button>
				</div>
			</div>
		</div>
	);
}
