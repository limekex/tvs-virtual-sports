import { DEBUG, err } from '../utils/debug.js';
import MyActivities from './MyActivities.js';
import ActivityCard from './ActivityCard.js';

export default function MyActivitiesStandalone({ React, routeId = 0, limit = 5, title = '' }) {
  const { useState, useEffect, createElement: h } = React;
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const isLoggedIn = !!(window.TVS_SETTINGS?.user);

  useEffect(() => {
    // Only load activities if user is logged in
    if (!isLoggedIn) {
      setActivities([]);
      return;
    }
    
    // Load on mount and whenever inputs change
    loadActivities();
    const handleActivityUpdate = () => {
      if (DEBUG) console.info('[TVS] MyActivitiesStandalone: Received activity update event, reloading...');
      loadActivities();
    };
    window.addEventListener('tvs:activity-updated', handleActivityUpdate);
    return () => {
      window.removeEventListener('tvs:activity-updated', handleActivityUpdate);
    };
  }, [routeId, limit, isLoggedIn]);

  async function loadActivities() {
    try {
      setLoadingActivities(true);

      const qs = new URLSearchParams();
      qs.set('per_page', String(limit));
      const rid = parseInt(routeId, 10) || 0;
      if (rid > 0) qs.set('route_id', String(rid));

      const r = await fetch(`/wp-json/tvs/v1/activities/me?${qs.toString()}` , {
        credentials: "same-origin",
        headers: {
          "X-TVS-Nonce": window.TVS_SETTINGS?.nonce || "",
          "X-WP-Nonce": window.TVS_SETTINGS?.nonce || ""
        }
      });
      if (!r.ok) {
        throw new Error("Failed to load activities");
      }
      const json = await r.json();
      const items = Array.isArray(json) ? json : (json.activities || []);
      setActivities(items);
    } catch (e) {
      err("Load activities FAIL:", e);
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }

  async function uploadToStrava(activityId) {
    try {
      setUploadingId(activityId);
      const r = await fetch(`/wp-json/tvs/v1/activities/${activityId}/strava`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": window.TVS_SETTINGS?.nonce || ""
        },
        credentials: "same-origin",
      });
      const res = await r.json();
      if (!r.ok) {
        throw new Error(res.message || "Upload failed");
      }
      window.tvsFlash("Uploaded to Strava!");
      await loadActivities();
      window.dispatchEvent(new CustomEvent('tvs:activity-updated'));
    } catch (e) {
      err("Strava upload FAIL:", e);
      window.tvsFlash("Failed to upload to Strava: " + (e?.message || String(e)), 'error');
    } finally {
      setUploadingId(null);
    }
  }

  if (!isLoggedIn) {
    const dummyActivities = Array.from({ length: 3 }).map((_, i) => ({
      id: 'dummy-' + i,
      meta: {
        _tvs_route_name: ["Mock Activity Preview " + (i + 1)],
        _tvs_activity_date: [new Date(Date.now() - i * 86400000).toISOString()],
        _tvs_distance_m: [Math.round(5000 + Math.random() * 5000)],
        _tvs_duration_s: [Math.round(1200 + Math.random() * 1800)],
      }
    }));
    return h(
      "div",
      { className: "tvs-activities-block tvs-panel" },
  h("h3", { className: "tvs-activities-title" }, (title && title.trim()) ? title : 'My Activities'),
      h(
        "div",
        { className: "tvs-activities-list" },
        dummyActivities.map((activity) =>
          h(ActivityCard, {
            key: activity.id,
            activity,
            React,
            compact: true,
            dummy: true
          })
        )
      ),
      h(
        "div",
        { className: "tvs-activities-footer" },
        h("div", { className: "tvs-text-muted", style: { marginBottom: '0.5rem' } }, "Sign in to see your recent activities."),
        h(
          "div",
          null,
          h("a", { href: "/login", className: "tvs-link", style: { marginRight: 12 } }, "Log in"),
          h("a", { href: "/register", className: "tvs-link" }, "Register")
        )
      )
    );
  }

  return h(MyActivities, { React, activities, loadingActivities, uploadToStrava, uploadingId, title });
}
