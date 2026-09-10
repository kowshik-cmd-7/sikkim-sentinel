import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/field-reporting")({
  beforeLoad: () => {
    throw redirect({
      to: "/report",
    });
  },
});
