import { Suspense, lazy, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import { ProtectedRoute } from "./ProtectedRoute";
import { Layout } from "@widgets/layout";
import { AppShellV2 } from "@widgets/layout-v2";
import { AntdProvider } from "../providers/AntdProvider";
import { featureFlags, isV2PageEnabled, type V2PageKey } from "@shared/config";

const Login = lazy(() => import("@pages/Login"));
const Dashboard = lazy(() => import("@pages/Dashboard"));
const SuperAdminDashboard = lazy(() => import("@pages/SuperAdminDashboard"));
const Students = lazy(() => import("@pages/Students"));
const StudentDetail = lazy(() => import("@pages/StudentDetail"));
const Attendance = lazy(() => import("@pages/Attendance"));
const Classes = lazy(() => import("@pages/Classes"));
const ClassDetail = lazy(() => import("@pages/ClassDetail"));
const Devices = lazy(() => import("@pages/Devices"));
const Holidays = lazy(() => import("@pages/Holidays"));
const Schools = lazy(() => import("@pages/Schools"));
const Users = lazy(() => import("@pages/Users"));
const Cameras = lazy(() => import("@pages/Cameras"));
const CamerasSuperAdmin = lazy(() => import("@pages/CamerasSuperAdmin"));
const UiGallery = lazy(() => import("@shared/ui/UiGallery"));

const DashboardV2 = lazy(() => import("@pages/v2/DashboardV2"));
const StudentsV2 = lazy(() => import("@pages/v2/StudentsV2"));
const DevicesV2 = lazy(() => import("@pages/v2/DevicesV2"));

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted">
      Yuklanmoqda...
    </div>
  );
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoader />}>{children}</Suspense>;
}

function ForceV2Redirect({ page }: { page: V2PageKey }) {
  const { schoolId } = useParams<{ schoolId: string }>();
  if (!schoolId) return <Navigate to="/dashboard" replace />;
  return <Navigate to={`/v2/schools/${schoolId}/${page}`} replace />;
}

export function AppRouter() {
  const enableV2 = featureFlags.uiV2Enabled;
  const forceV2 = featureFlags.uiV2Force;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <RouteSuspense>
              <Login />
            </RouteSuspense>
          }
        />

        {forceV2 && enableV2 && isV2PageEnabled("dashboard") && (
          <Route
            path="/schools/:schoolId/dashboard"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <ForceV2Redirect page="dashboard" />
              </ProtectedRoute>
            }
          />
        )}
        {forceV2 && enableV2 && isV2PageEnabled("students") && (
          <Route
            path="/schools/:schoolId/students"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <ForceV2Redirect page="students" />
              </ProtectedRoute>
            }
          />
        )}
        {forceV2 && enableV2 && isV2PageEnabled("devices") && (
          <Route
            path="/schools/:schoolId/devices"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "GUARD"]}>
                <ForceV2Redirect page="devices" />
              </ProtectedRoute>
            }
          />
        )}

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AntdProvider>
                <Layout />
              </AntdProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route
            path="dashboard"
            element={
              <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                <RouteSuspense>
                  <SuperAdminDashboard />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="schools"
            element={
              <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                <RouteSuspense>
                  <Schools />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="cameras"
            element={
              <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                <RouteSuspense>
                  <CamerasSuperAdmin />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="schools/:schoolId/dashboard"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                {forceV2 && isV2PageEnabled("dashboard") ? (
                  <ForceV2Redirect page="dashboard" />
                ) : (
                  <RouteSuspense>
                    <Dashboard />
                  </RouteSuspense>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/students"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                {forceV2 && isV2PageEnabled("students") ? (
                  <ForceV2Redirect page="students" />
                ) : (
                  <RouteSuspense>
                    <Students />
                  </RouteSuspense>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/attendance"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <RouteSuspense>
                  <Attendance />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/classes"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <RouteSuspense>
                  <Classes />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/classes/:classId"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <RouteSuspense>
                  <ClassDetail />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/cameras"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]}>
                <RouteSuspense>
                  <Cameras />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/devices"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "GUARD"]}>
                {forceV2 && isV2PageEnabled("devices") ? (
                  <ForceV2Redirect page="devices" />
                ) : (
                  <RouteSuspense>
                    <Devices />
                  </RouteSuspense>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/holidays"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN"]}>
                <RouteSuspense>
                  <Holidays />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/users"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "SUPER_ADMIN"]}>
                <RouteSuspense>
                  <Users />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/students/:id"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <RouteSuspense>
                  <StudentDetail />
                </RouteSuspense>
              </ProtectedRoute>
            }
          />

          {import.meta.env.DEV && (
            <Route
              path="ui-gallery"
              element={
                <RouteSuspense>
                  <UiGallery />
                </RouteSuspense>
              }
            />
          )}
        </Route>

        {enableV2 && (
          <Route
            path="/v2"
            element={
              <ProtectedRoute>
                <AppShellV2 />
              </ProtectedRoute>
            }
          >
            {isV2PageEnabled("dashboard") && (
              <Route
                path="schools/:schoolId/dashboard"
                element={
                  <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                    <RouteSuspense>
                      <DashboardV2 />
                    </RouteSuspense>
                  </ProtectedRoute>
                }
              />
            )}
            {isV2PageEnabled("students") && (
              <Route
                path="schools/:schoolId/students"
                element={
                  <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                    <RouteSuspense>
                      <StudentsV2 />
                    </RouteSuspense>
                  </ProtectedRoute>
                }
              />
            )}
            {isV2PageEnabled("devices") && (
              <Route
                path="schools/:schoolId/devices"
                element={
                  <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "GUARD"]}>
                    <RouteSuspense>
                      <DevicesV2 />
                    </RouteSuspense>
                  </ProtectedRoute>
                }
              />
            )}
          </Route>
        )}

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
