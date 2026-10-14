/**
 * Check helpers: log PASS/FAIL per check like the Playwright smoke suites
 * do, aggregate a summary, and let the runner exit non-zero on failure.
 */
const state = { pass: 0, fail: 0, failures: [] }

export function check(name, cond, detail = "") {
  if (cond) {
    state.pass++
    console.log(`  PASS ${name}`)
  } else {
    state.fail++
    state.failures.push(name)
    console.error(`  FAIL ${name}${detail ? " — " + detail : ""}`)
  }
  return Boolean(cond)
}

/** Asserts the response status and returns the parsed body for further checks. */
export function status(name, res, expected) {
  check(`${name} -> ${expected}`, res.status === expected, `got ${res.status}: ${res.text?.slice(0, 200)}`)
  return res.body
}

export function eq(name, actual, expected) {
  return check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`
  )
}

export function summary() {
  console.log(`\n  ${state.pass} passed, ${state.fail} failed`)
  if (state.fail > 0) {
    console.error("\n  Failed checks:")
    for (const f of state.failures) console.error(`    - ${f}`)
  }
  return state.fail === 0
}
