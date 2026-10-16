import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import TallyList from "@/pages/TallyList";
import TallyEditor from "@/pages/TallyEditor";
import TallyDetail from "@/pages/TallyDetail";
import TallyPrint from "@/pages/TallyPrint";
import BeritaAcaraPrint from "@/pages/BeritaAcaraPrint";
import MasterData from "@/pages/MasterData";
import MasterUpload from "@/pages/MasterUpload";
import MasterSupplier from "@/pages/MasterSupplier";
import Users from "@/pages/Users";
import Activity from "@/pages/Activity";
import Settings from "@/pages/Settings";
import Reports from "@/pages/Reports";

function Loading() {
  return (
    <div className="min-h-screen grid place-items-center text-slate-500 text-sm" data-testid="app-loading">
      Memuat...
    </div>
  );
}

function Protected({ children, admin }) {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  return user ? <Navigate to="/" replace /> : children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/tally/:id/print" element={<Protected><TallyPrint /></Protected>} />
          <Route path="/tally/:id/print-ba" element={<Protected><BeritaAcaraPrint /></Protected>} />
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="tally" element={<TallyList />} />
            <Route path="tally/new" element={<TallyEditor />} />
            <Route path="tally/:id" element={<TallyDetail />} />
            <Route path="tally/:id/edit" element={<TallyEditor />} />
            <Route path="reports" element={<Reports />} />
            <Route path="master" element={<MasterData />} />
            <Route path="master/upload" element={<Navigate to="/master?tab=materials&upload=1" replace />} />
            <Route path="suppliers" element={<Navigate to="/master?tab=suppliers" replace />} />
            <Route path="users" element={<Protected admin><Users /></Protected>} />
            <Route path="activity" element={<Protected admin><Activity /></Protected>} />
            <Route path="settings" element={<Protected admin><Settings /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
