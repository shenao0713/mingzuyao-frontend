const DEFAULT_REDIRECT = "/portal";

export function normalizeRedirectPath(value) {
  if (!value || typeof value !== "string") {
    return DEFAULT_REDIRECT;
  }

  let candidate = value.trim();
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return DEFAULT_REDIRECT;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  if (candidate.startsWith("/login")) {
    return DEFAULT_REDIRECT;
  }

  return candidate;
}

export function buildLoginPath(redirectPath = DEFAULT_REDIRECT) {
  const target = normalizeRedirectPath(redirectPath);
  return `/login?redirect=${encodeURIComponent(target)}`;
}
