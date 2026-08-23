/**
 * Sanitizes raw server errors to prevent exposing backend stack traces,
 * database names, or query details to the end-user.
 */
export function cleanErrorMessage(message?: string | null, fallback: string = "An unexpected error occurred."): string {
  if (!message) return fallback;
  
  const lowercase = message.toLowerCase();
  if (
    lowercase.includes("prisma") ||
    lowercase.includes("database") ||
    lowercase.includes("postgres") ||
    lowercase.includes("sql") ||
    lowercase.includes("connection") ||
    lowercase.includes("stack") ||
    lowercase.includes("unique constraint") ||
    lowercase.includes("foreign key") ||
    lowercase.includes("internal server error") ||
    lowercase.includes("schema")
  ) {
    return "A network or system error occurred. Please try again later.";
  }
  
  return message;
}
