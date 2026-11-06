// Mesma conta administradora de userPermissionsServerSide (a de 2024 deixou de existir em 25/08/2026).
const DEFAULT_FINANCE_ADMIN_ID = "6a8799078ecd649be9bdb061";

function configuredAdminIds(rawConfigured: string) {
  const configured = rawConfigured
    .split(/[;,\s]+/)
    .map((value) => value.trim().replace(/^auth0\|/, ""))
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
  return allowedIds.has(userId);
}
