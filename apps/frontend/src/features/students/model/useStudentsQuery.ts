import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { classesService } from "@entities/class";
import { studentsService, type StudentsFilters } from "@entities/student";
import type { Student } from "@shared/types";
import { queryKeys } from "@shared/query";

export function useStudentsQuery(params: {
  schoolId: string | null;
  filters: Omit<StudentsFilters, "page" | "limit"> & { page: number; limit: number };
}) {
  const { schoolId, filters } = params;

  const studentsListQuery = useQuery({
    queryKey: schoolId
      ? queryKeys.students.list({
          schoolId,
          page: filters.page,
          search: filters.search,
          classId: filters.classId,
          period: filters.period,
          startDate: filters.startDate,
          endDate: filters.endDate,
        })
      : [...queryKeys.students.all, "list", "idle"],
    queryFn: () =>
      studentsService.getAll(schoolId!, {
        page: filters.page,
        limit: filters.limit,
        search: filters.search,
        classId: filters.classId,
        period: filters.period,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    enabled: Boolean(schoolId),
  });

  const classesQuery = useQuery({
    queryKey: schoolId
      ? queryKeys.students.classes(schoolId)
      : [...queryKeys.students.all, "classes", "idle"],
    queryFn: () => classesService.getAll(schoolId!),
    enabled: Boolean(schoolId),
  });

  return { studentsListQuery, classesQuery };
}

export function useStudentsMutations(schoolId: string | null) {
  const queryClient = useQueryClient();

  const invalidateStudents = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
  };

  const createStudentMutation = useMutation({
    mutationFn: (data: Partial<Student>) => studentsService.create(schoolId!, data),
    onSuccess: invalidateStudents,
  });

  const updateStudentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Student> }) =>
      studentsService.update(id, data),
    onSuccess: invalidateStudents,
  });

  const deleteStudentMutation = useMutation({
    mutationFn: (id: string) => studentsService.delete(id),
    onSuccess: invalidateStudents,
  });

  return {
    createStudentMutation,
    updateStudentMutation,
    deleteStudentMutation,
    invalidateStudents,
  };
}
