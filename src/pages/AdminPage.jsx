import { ColorModeContext, useMode } from "../theme";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Routes, Route } from "react-router-dom";
import Topbar from "../scenes/global/Topbar";
import Sidebar from "../scenes/global/Sidebar";
import Dashboard from "../scenes/dashboard";
import Team from "../scenes/users";
import Content from "../scenes/content";
import ServerStatus from "../scenes/server";
import Settings from "../scenes/settings";
import "../admin.css"; 
import "../admin-glass.css"; 

const AdminPage = () => {
  const [theme, colorMode] = useMode();

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="app">
          <Sidebar />
          <main className="content" style={{ flexGrow: 1, height: "100%", overflowY: "auto", position: "relative" }}>
            <Topbar />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/team" element={<Team />} />
              <Route path="/content" element={<Content />} />
              <Route path="/server" element={<ServerStatus />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default AdminPage;
