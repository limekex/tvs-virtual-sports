import ActivityCard from './ActivityCard.js';

export default function MyActivities({ React, activities, loadingActivities, uploadToStrava, uploadingId }) {
  const { useState, createElement: h } = React;
  const [min, setMin] = useState(false);

  const recentActivities = activities.slice(0, 5);

  return h(
    "div",
    {
      className: "tvs-activities-block"
    },
    h(
      "div",
  { className: "tvs-row between tvs-mb-4" },
      h("h3", null, "Recent Activities"),
      h(
        "button",
        {
          onClick: () => setMin(!min),
          className: "tvs-btn tvs-btn--ghost",
          "aria-label": min ? "Expand" : "Minimize"
        },
        min ? "▸" : "▾"
      )
    ),
    min
      ? null
      : loadingActivities
      ? h("p", { className: 'tvs-muted' }, "Loading activities...")
      : recentActivities.length === 0
      ? h("p", { className: 'tvs-muted' }, "Start a new activity when you're ready")
      : h(
          "div",
          null,
          h(
            "div",
            { className: "tvs-activities-list tvs-mb-4" },
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
            { className: "tvs-text-center tvs-pt-2 tvs-border-top" },
            h(
              "a",
              { href: "/my-activities", className: 'tvs-muted' },
              "Go to my activities →"
            )
          )
        )
  );
}
