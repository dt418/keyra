import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui";
import Root from "./routes/root";
import Login from "./routes/login";
import Register from "./routes/register";
import PublicRoute from "./routes/_public";
import ProtectedRoute from "./routes/_protected";
import DashboardLayout from "./routes/_dashboard";
import DashboardIndex from "./routes/dashboard";
import Analytics from "./routes/analytics";
import Organizations from "./routes/organizations";
import Products from "./routes/products";
import Licenses from "./routes/licenses";
import Devices from "./routes/devices";
import AuditLogs from "./routes/audit-logs";
import Webhooks from "./routes/webhooks";
import ApiKeys from "./routes/api-keys";
import Settings from "./routes/settings";
import Support from "./routes/support";
import Docs from "./routes/docs";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route element={<Root />}>
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<DashboardIndex />} />
                <Route path="/dashboard/analytics" element={<Analytics />} />
                <Route
                  path="/dashboard/organizations"
                  element={<Organizations />}
                />
                <Route path="/dashboard/products" element={<Products />} />
                <Route path="/dashboard/licenses" element={<Licenses />} />
                <Route path="/dashboard/devices" element={<Devices />} />
                <Route path="/dashboard/audit-logs" element={<AuditLogs />} />
                <Route path="/dashboard/webhooks" element={<Webhooks />} />
                <Route path="/dashboard/api-keys" element={<ApiKeys />} />
                <Route path="/dashboard/settings" element={<Settings />} />
                <Route path="/dashboard/support" element={<Support />} />
                <Route path="/dashboard/docs" element={<Docs />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
