import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Media from "@/pages/admin/Media";
import Playlists from "@/pages/admin/Playlists";
import Campaigns from "@/pages/admin/Campaigns";
import TVs from "@/pages/admin/TVs";
import Settings from "@/pages/admin/Settings";
import Display from "@/pages/Display";

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading || user === null)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <div className="App">
      <Toaster theme="dark" position="top-right" richColors />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/display/:tvId" element={<Display />} />
            <Route
              path="/admin"
              element={
                <Protected>
                  <AdminLayout />
                </Protected>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="media" element={<Media />} />
              <Route path="playlists" element={<Playlists />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="tvs" element={<TVs />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
