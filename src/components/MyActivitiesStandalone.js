import { DEBUG, err } from '../utils/debug.js';
import MyActivities from './MyActivities.js';
import ActivityCard from './ActivityCard.js';

export default function MyActivitiesStandalone({ React }) {
  const { useState, useEffect, createElement: h } = React;
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const isLoggedIn = !!(window.TVS_SETTINGS?.user);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadActivities();
    const handleActivityUpdate = () => {
      if (DEBUG) console.info('[TVS] MyActivitiesStandalone: Received activity update event, reloading...');
      loadActivities();
    };
    window.addEventListener('tvs:activity-updated', handleActivityUpdate);
    return () => {
      window.removeEventListener('tvs:activity-updated', handleActivityUpdate);
    };
  }, []);

  async function loadActivities() {
    try {
      setLoadingActivities(true);
      const url = "/wp-json/tvs/v1/activities/me";
      const r = await fetch(url, {
        credentials: "same-origin",
        headers: {
          "X-TVS-Nonce": window.TVS_SETTINGS?.nonce || ""
        }
      });
      if (!r.ok) {
        throw new Error("Failed to load activities");
      }
      const json = await r.json();
      const activitiesData = Array.isArray(json) ? json : (json.activities || []);
      setActivities(activitiesData);
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
        _tvs_route_name: ["Sample Route " + (i + 1)],
        _tvs_activity_date: [new Date(Date.now() - i * 86400000).toISOString()],
        _tvs_distance_m: [Math.round(5000 + Math.random() * 5000)],
        _tvs_duration_s: [Math.round(1200 + Math.random() * 1800)],
      }
    }));
    return h(
      "div",
      { className: "tvs-activities-block", style: { marginTop: "1rem", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", padding: "1rem" } },
      h("h3", { style: { marginTop: 0 } }, "My Activities"),
      h(
        "div",
        { className: "tvs-activities-list", style: { marginBottom: "1rem" } },
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
        { style: { textAlign: "center", color: "#888", fontSize: "0.95rem", marginBottom: "0.5rem" } },
        "Sign in to see your recent activities."
      ),
      h(
        "div",
        { style: { textAlign: "center" } },
        h(
          "a",
          { href: "/login", style: { color: '#1f2937', textDecoration: 'underline', marginRight: 12 } },
          "Log in"
        ),
        h(
          "a",
          { href: "/register", style: { color: '#1f2937', textDecoration: 'underline' } },
          "Register"
        )
      )
    );
  }

  return h(MyActivities, { React, activities, loadingActivities, uploadToStrava, uploadingId });
}
