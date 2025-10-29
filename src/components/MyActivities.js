import ActivityCard from './ActivityCard.js';

export default function MyActivities({ React, activities, loadingActivities, uploadToStrava, uploadingId }) {
  const { useState, createElement: h } = React;
  const [min, setMin] = useState(false);

  const recentActivities = activities.slice(0, 5);

  return h(
    "div",
    {
      className: "tvs-activities-block",
      style: { marginTop: "1rem", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", padding: "1rem" }
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" } },
      h("h3", { style: { margin: 0, fontSize: "1.25rem" } }, "Recent Activities"),
      h(
        "button",
        {
          onClick: () => setMin(!min),
          style: { fontSize: "1.2em", background: "none", border: "none", cursor: "pointer", color: "#666" },
          "aria-label": min ? "Expand" : "Minimize"
        },
        min ? "▸" : "▾"
      )
    ),
    min
      ? null
      : loadingActivities
      ? h("p", { style: { color: "#666" } }, "Loading activities...")
      : recentActivities.length === 0
      ? h("p", { style: { color: "#666" } }, "Start a new activity when you're ready")
      : h(
          "div",
          null,
          h(
            "div",
            { className: "tvs-activities-list", style: { marginBottom: "1rem" } },
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
            { style: { textAlign: "center", paddingTop: "0.5rem", borderTop: "1px solid #e5e7eb" } },
            h(
              "a",
              {
                href: "/my-activities",
                style: { color: "#2563eb", textDecoration: "none", fontSize: "0.9rem" }
              },
              "Go to my activities →"
            )
          )
        )
  );
}
