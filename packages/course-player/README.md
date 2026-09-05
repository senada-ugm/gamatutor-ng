# @gamatutor/course-player

The GamaTutor native course runtime. Framework-free, **zero third-party runtime
dependencies** — it renders into a DOM given a `Course` and a `TrackingAdapter`,
and runs unchanged inside the Next.js app, inside a standalone SCORM package,
and inside a service-worker-cached shell.

`@gamatutor/course-schema` and `@gamatutor/tracking` are listed under
`devDependencies` rather than `dependencies` on purpose: they are workspace
siblings bundled into the same artifact, not external packages. The
zero-dependency rule is about third-party code. Do not "fix" this by promoting
them.
