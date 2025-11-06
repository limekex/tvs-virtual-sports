import ActivityCard from './ActivityCard.js';

export default function MyActivities({ React, activities, loadingActivities, uploadToStrava, uploadingId, title }) {
  const { useState, createElement: h } = React;
  const [min, setMin] = useState(false);

  const recentActivities = activities.slice(0, 5);
  const heading = title && String(title).trim() ? String(title) : 'Recent Activities';

  return h(
    "div",
    { className: "tvs-activities-block tvs-panel" },
    h(
      "div",
      { className: "tvs-activities-header" },
  h("h3", { className: "tvs-activities-title" }, heading),
      h(
        "button",
        {
          onClick: () => setMin(!min),
          className: "tvs-icon-btn",
          "aria-label": min ? "Expand" : "Minimize"
        },
        min ? "▸" : "▾"
      )
    ),
    min
      ? null
      : loadingActivities
      ? h(
          "div",
          { className: "tvs-activities-list" },
          // Shimmer skeleton placeholders while loading
          [0, 1, 2].map((i) =>
            h(
              "div",
              { key: `skel-${i}`, className: "tvs-activity-card-compact" },
              h("div", { className: "tvs-skel line", style: { width: "60%" } }),
              h("div", { className: "tvs-skel line sm", style: { width: "40%" } })
            )
          )
        )
      : recentActivities.length === 0
      ? h("p", { className: "tvs-text-muted" }, "Start a new activity when you're ready")
      : h(
          "div",
          null,
          h(
            "div",
            { className: "tvs-activities-list" },
            recentActivities.map((activity) =>
              h(ActivityCard, {
                key: activity.id,
                activity,
                uploadToStrava,
                uploading: uploadingId === activity.id,
                React,
                compact: true
              })
            )
          ),
          h(
            "div",
            { className: "tvs-activities-footer" },
            h(
              "a",
              { href: "/my-activities", className: "tvs-link tvs-text-sm" },
              "Go to my activities →"
            )
          )
        )
  );
}
