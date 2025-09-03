import { Suspense } from "react";
import NavBar from "./NavBar";
import SyncBadge from "./SyncBadge";

interface LayoutProps {
    children: React.ReactElement,
    setDashboard: (v: boolean) => void,
    view: string
}

const Layout: React.FC<LayoutProps> = ({children, setDashboard, view}) => {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <NavBar view={view} setDashboard={setDashboard} />
      <Suspense fallback={<div>Loading...</div>}>
        <div
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            flexDirection: "row",
          }}>
          {children}
        </div>
      </Suspense>
      <SyncBadge />
    </div>
  );
};

export default Layout;
