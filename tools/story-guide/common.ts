// Story Guide: small things shared by the Project Gutenberg modules. A build-time tool: it never
// ships in the app.

export const USER_AGENT =
  'DogEaredTalesStoryGuide/1.0 (local hackathon tool; https://github.com/rajivsundar/dog-eared-tales)'

/** A friendly failure: the message is safe to show on the page. */
export class GutenbergError extends Error {}

export type Fetch = typeof fetch
