const DEFAULT_FINANCE_ADMIN_ID = "67098341f7397b370e9cb8ba";

function configuredAdminIds(rawConfigured: string) {
  const configured = rawConfigured
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(
    configured.length > 0 ? configured : [DEFAULT_FINANCE_ADMIN_ID],
  );
}

export function isFinanceAdminSubject(
  subject: unknown,
  rawConfigured = "",
): subject is string {
  if (typeof subject !== "string" || subject.trim() === "") return false;
  const normalizedSubject = subject.trim();
  const userId = normalizedSubject.replace(/^auth0\|/, "");
  const allowedIds = configuredAdminIds(rawConfigured);
  return allowedIds.has(normalizedSubject) || allowedIds.has(userId);
}
