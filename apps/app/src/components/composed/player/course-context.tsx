import { createContext, useContext } from "react"
import type { ContractCourse } from "@workspace/contracts/domain"

export interface CourseContextValue {
  course: ContractCourse
  completedLessonIds: string[]
  refreshProgress: () => Promise<void>
}

const CourseContext = createContext<CourseContextValue | null>(null)

export function CourseContextProvider({ value, children }: { value: CourseContextValue; children: React.ReactNode }) {
  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
}

export function useCourseContext(): CourseContextValue {
  const ctx = useContext(CourseContext)
  if (!ctx) throw new Error("useCourseContext must be used within CourseContextProvider")
  return ctx
}
