import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://0a351a99279cccc3b99e9cbd488f353d@o4511434840670208.ingest.de.sentry.io/4511434883792976",
  tracesSampleRate: 1,
  enableLogs: true,
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
