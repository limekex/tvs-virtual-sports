import ActivityCard from './ActivityCard.js';

export default function MyActivities({ React, activities, loadingActivities, uploadToStrava, uploadingId }) {
  const { useState, createElement: h } = React;
  const [min, setMin] = useState(false);

  const recentActivities = activities.slice(0, 5);

  return h(
    "div",
    { className: "tvs-activities-block tvs-panel" },
    h(
      "div",
      { className: "tvs-activities-header" },
      h("h3", { className: "tvs-activities-title" }, "Recent Activities"),
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
      ? h("p", { className: "tvs-text-muted" }, "Loading activities...")
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
