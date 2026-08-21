import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Dashboard } from "./pages/Dashboard";
import { Documents } from "./pages/Documents";
import { DocumentViewer } from "./pages/DocumentViewer";
import { UploadDocument } from "./pages/UploadDocument";
import { AdminPanel } from "./pages/AdminPanel";
import { AuditLogs } from "./pages/AuditLogs";
import { Analytics } from "./pages/Analytics";
import { Reports } from "./pages/Reports";
import { ProfileSettings } from "./pages/ProfileSettings";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "documents", Component: Documents },
      { path: "documents/:id", Component: DocumentViewer },
      { path: "upload", Component: UploadDocument },
      { path: "admin", Component: AdminPanel },
      { path: "audit", Component: AuditLogs },
      { path: "analytics", Component: Analytics },
      { path: "reports", Component: Reports },
      { path: "settings", Component: ProfileSettings },
      { path: "*", Component: NotFound },
    ],
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
  },
]);
