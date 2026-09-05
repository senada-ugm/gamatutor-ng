# Imported packages

SCORM packages produced by other tools, hosted as-is. Nothing in here is
authored in this repo, and nothing in here should be edited: a package is a
build output of whatever produced it, and hand-editing one breaks the link back
to its source.

Each course is a directory holding the untouched `package.zip` plus a
`meta.json` recording where it came from. `tools/deploy.sh` extracts them
alongside the natively-built courses.

| Course | From |
|---|---|
| `dasar-algoritma` | SlideForge, built from `demo-algoritma.pptx` |

This is deliberately the crude version of what slice S4 does properly. S4 adds
real import: manifest parsing and validation, immutable course versions, a
separate content origin, and a `postMessage` bridge that translates the
package's SCORM calls into GamaTutor's own event spine so imported courses land
in the same gradebook as native ones. Today these are static files with no
tracking — the package looks for an LMS API, finds none, and runs ungraded.
