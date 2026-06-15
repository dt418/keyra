import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui';
import Root from './routes/root';
import Login from './routes/login';
import Register from './routes/register';
import PublicRoute from './routes/_public';
import ProtectedRoute from './routes/_protected';
import DashboardLayout from './routes/_dashboard';
import DashboardIndex from './routes/dashboard';
import Organizations from './routes/organizations';
import Products from './routes/products';
import Licenses from './routes/licenses';
import Devices from './routes/devices';
import ApiKeys from './routes/api-keys';
import Settings from './routes/settings';
import Support from './routes/support';

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
              <Route path="/dashboard/organizations" element={<Organizations />} />
              <Route path="/dashboard/products" element={<Products />} />
              <Route path="/dashboard/licenses" element={<Licenses />} />
              <Route path="/dashboard/devices" element={<Devices />} />
              <Route path="/dashboard/api-keys" element={<ApiKeys />} />
              <Route path="/dashboard/settings" element={<Settings />} />
              <Route path="/dashboard/support" element={<Support />} />
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
