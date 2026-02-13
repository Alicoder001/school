import React, { useState } from "react";
import { Lock, LogIn, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@entities/auth";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { featureFlags, isV2PageEnabled } from "@shared/config";

type LoginFormState = {
  email: string;
  password: string;
};

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [form, setForm] = useState<LoginFormState>({
    email: "admin@system.com",
    password: "admin123",
  });
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorText(null);
    try {
      const user = await login(form.email.trim(), form.password);

      if (
        featureFlags.uiV2Enabled &&
        featureFlags.uiV2Force &&
        user.role !== "SUPER_ADMIN" &&
        user.schoolId &&
        isV2PageEnabled("dashboard")
      ) {
        navigate(`/v2/schools/${user.schoolId}/dashboard`, { replace: true });
        return;
      }

      if (user.role === "SUPER_ADMIN") {
        navigate("/dashboard", { replace: true });
      } else if (user.schoolId) {
        navigate(`/schools/${user.schoolId}/dashboard`, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === "string"
          ? (error as { response: { data: { error: string } } }).response.data.error
          : "Kirishda xatolik";
      setErrorText(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_#eef4fb_45%,_#f8fafc_100%)] p-4">
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-lg backdrop-blur">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl text-primary">Davomat tizimi</CardTitle>
          <p className="text-sm text-muted">Hisobingizga kiring</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted" htmlFor="email">
                Elektron pochta
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="pl-9"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted" htmlFor="password">
                Parol
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="pl-9"
                  value={form.password}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                />
              </div>
            </div>

            {errorText ? (
              <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {errorText}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Kirilmoqda..." : "Kirish"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

