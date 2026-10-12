import type {
  CourseCreate,
  CourseUpdate,
  CoursesApiCreateResponse,
  CoursesApiGetResponse,
  CoursesApiListResponse,
  CoursesApiUpdateResponse,
} from "@workspace/contracts"
import { zCourseCreate, zCourseUpdate } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { inArray, or, eq, type SQL } from "drizzle-orm"
import { z } from "zod"

import { isActiveParticipant, isCourseManager } from "../../../lib/course-access.js"
import { NotFoundError } from "../../../lib/errors.js"
import { getOptionalSession, requireSession } from "../../../lib/require-session.js"
import { dataResponse, pagedResponse } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import { courses } from "../../../db/app-schema.js"
import * as service from "../services/courses.service.js"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  q: z.string().optional(),
  orderBy: z.string().optional(),
  institutionId: z.string().optional(),
  status: z.string().optional(),
})

export function coursesRoutes(app: FastifyInstance) {
  app.get("/courses", async (request): Promise<CoursesApiListResponse> => {
    const query = listQuerySchema.parse(request.query)

    // Everyone sees published courses. Beyond that, a signed-in caller
    // also sees drafts of institutions they own and courses they
    // actively teach — folded into the WHERE clause (not post-filtered)
    // so pagination and totalCount stay truthful. An anonymous caller
    // passing e.g. status=draft gets an empty page, not the drafts.
    const viewer = await getOptionalSession(request)
    let visibility: SQL | undefined
    if (!viewer || viewer.role !== "admin") {
      const scope = viewer
        ? await service.visibleCourseScope(viewer)
        : { ownedInstitutionIds: [], instructedCourseIds: [] }
      visibility = or(
        eq(courses.status, "published"),
        scope.ownedInstitutionIds.length > 0 ? inArray(courses.institutionId, scope.ownedInstitutionIds) : undefined,
        scope.instructedCourseIds.length > 0 ? inArray(courses.id, scope.instructedCourseIds) : undefined
      )
    }

    const { rows, totalCount } = await service.listCourses({
      institutionId: query.institutionId,
      status: query.status,
      search: query.search ?? query.q,
      orderBy: query.orderBy,
      page: query.page,
      pageSize: query.pageSize,
      visibility,
    })
    return pagedResponse(rows, totalCount, request.id, {
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.get<{ Params: { id: string } }>("/courses/:id", async (request): Promise<CoursesApiGetResponse> => {
    // Published courses are public, but only their preview lessons carry
    // material — full content requires being a course manager or an
    // active participant. Unpublished courses 404 for anyone else
    // (existence itself isn't public while drafting).
    const row = await service.getCourseRow(request.params.id)
    const viewer = await getOptionalSession(request)
    const entitled =
      !!viewer && ((await isCourseManager(viewer, row.id)) || (await isActiveParticipant(viewer.id, row.id)))
    if (!entitled) {
      if (row.status !== "published") throw new NotFoundError("Course", row.id)
      return dataResponse(await service.getCourse(request.params.id, { previewOnly: true }), request.id)
    }
    return dataResponse(await service.getCourse(request.params.id), request.id)
  })

  app.post<{ Body: CourseCreate }>(
    "/courses",
    { preValidation: [validateBody(zCourseCreate)] },
    async (request, reply): Promise<CoursesApiCreateResponse> => {
      const user = await requireSession(request)
      const created = await service.createCourse(request.body, user)
      reply.status(201)
      reply.header("Location", `/v1/courses/${created.id}`)
      return dataResponse(created, request.id)
    }
  )

  app.patch<{ Params: { id: string }; Body: CourseUpdate }>(
    "/courses/:id",
    { preValidation: [validateBody(zCourseUpdate)] },
    async (request): Promise<CoursesApiUpdateResponse> => {
      const user = await requireSession(request)
      return dataResponse(await service.updateCourse(request.params.id, request.body, user), request.id)
    }
  )

  app.post<{ Params: { id: string } }>("/courses/:id/publish", async (request) => {
    const user = await requireSession(request)
    return dataResponse(await service.publishCourse(request.params.id, user), request.id)
  })

  app.post<{ Params: { id: string } }>("/courses/:id/unpublish", async (request) => {
    const user = await requireSession(request)
    return dataResponse(await service.unpublishCourse(request.params.id, user), request.id)
  })
}
