import { useState } from "react";
import { Sidebar as ProSidebar, Menu, MenuItem } from "react-pro-sidebar";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import { Link } from "react-router-dom";
import { tokens } from "../../theme";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import MovieCreationOutlinedIcon from "@mui/icons-material/MovieCreationOutlined";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

const Item = ({ title, to, icon, selected, setSelected }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  return (
    <MenuItem
      active={selected === title}
      style={{
        color: colors.grey[100],
      }}
      onClick={() => setSelected(title)}
      icon={icon}
      component={<Link to={to} />}
    >
      <Typography>{title}</Typography>
    </MenuItem>
  );
};

const Sidebar = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selected, setSelected] = useState("Dashboard");

  return (
    <Box
      sx={{
        "& .ps-sidebar-root": {
          height: "100%",
          border: "none",
        },
        "& .ps-sidebar-container": {
          backgroundColor: "transparent !important",
        },
        "@media (max-width: 768px)": {
            position: "absolute",
            zIndex: 1000,
            height: "100%",
            "& .ps-sidebar-root": {
                width: isCollapsed ? "80px" : "250px", 
            }
        }
      }}
    >
      <ProSidebar 
        collapsed={isCollapsed}
        breakPoint="md"
        backgroundColor={colors.primary[400]}
      >
        <Menu iconShape="square">
          {/* LOGO AND MENU ICON */}
          <MenuItem
            onClick={() => setIsCollapsed(!isCollapsed)}
            icon={isCollapsed ? <MenuOutlinedIcon /> : undefined}
            style={{
              margin: "10px 0 20px 0",
              color: colors.grey[100],
            }}
          >
            {!isCollapsed && (
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                ml="15px"
              >
                <Typography variant="h3" color={colors.grey[100]}>
                  NOXIS ADMIN
                </Typography>
                <IconButton onClick={() => setIsCollapsed(!isCollapsed)}>
                  <MenuOutlinedIcon />
                </IconButton>
              </Box>
            )}
          </MenuItem>

          {!isCollapsed && (
            <Box mb="25px">
              <Box display="flex" justifyContent="center" alignItems="center">
                <img
                  alt="profile-user"
                  width="100px"
                  height="100px"
                  src={`../../assets/logo.png`}
                  style={{ cursor: "pointer", borderRadius: "50%", objectFit: "contain" }}
                />
              </Box>
              <Box textAlign="center">
                <Typography
                  variant="h2"
                  color={colors.grey[100]}
                  fontWeight="bold"
                  sx={{ m: "10px 0 0 0" }}
                >
                  Admin
                </Typography>
                <Typography variant="h5" color={colors.greenAccent[500]}>
                  System Administrator
                </Typography>
              </Box>
            </Box>
          )}

          <Box paddingLeft={isCollapsed ? undefined : "10%"}>
            <Item
              title="Dashboard"
              to="/admin"
              icon={<HomeOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />

            <Typography
              variant="h6"
              color={colors.grey[300]}
              sx={{ m: "15px 0 5px 20px" }}
            >
              Management
            </Typography>
            <Item
              title="Manage Users"
              to="/admin/team"
              icon={<PeopleOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
            <Item
              title="Content Library"
              to="/admin/content"
              icon={<MovieCreationOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />

            <Typography
              variant="h6"
              color={colors.grey[300]}
              sx={{ m: "15px 0 5px 20px" }}
            >
              System
            </Typography>
            <Item
              title="Server Status"
              to="/admin/server"
              icon={<DnsOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
             <Item
              title="Settings"
              to="/admin/settings"
              icon={<SettingsOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
          </Box>
        </Menu>
      </ProSidebar>
    </Box>
  );
};

export default Sidebar;
