/** Wraps user input into an ILIKE "contains" pattern with the LIKE
 *  metacharacters (%, _, \) escaped. Drizzle parameterizes the value, so
 *  this is not SQL injection — but unescaped metacharacters let a `%`
 *  search match every row or probe data by pattern. Postgres's default
 *  LIKE escape character is backslash. */
export function ilikeContains(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`
}
