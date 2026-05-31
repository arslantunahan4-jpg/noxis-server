import { Box, Typography, useTheme } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { tokens } from "../../theme";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import Header from "../../components/Header";
import { useState, useEffect } from "react";

const Team = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [teamData, setTeamData] = useState([]);

  useEffect(() => {
    // Fetch users and map _id to id for DataGrid compatibility
    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('noxis_auth_token');
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                const formattedData = data.users.map(user => ({
                    ...user,
                    id: user._id,
                    access: user.role
                }));
                setTeamData(formattedData);
            }
        } catch (error) {
            console.error("Failed to fetch users", error);
        }
    };
    
    fetchUsers();
  }, []);

  const columns = [
    { field: "id", headerName: "ID", flex: 1 },
    {
      field: "username",
      headerName: "Username",
      flex: 1,
      cellClassName: "name-column--cell",
    },
    {
      field: "email",
      headerName: "Email",
      flex: 1,
    },
    {
      field: "role",
      headerName: "Access Level",
      flex: 1,
      renderCell: ({ row: { access } }) => {
        return (
          <Box
            width="60%"
            m="0 auto"
            p="5px"
            display="flex"
            justifyContent="center"
            backgroundColor={
              access === "admin"
                ? colors.greenAccent[600]
                : access === "moderator"
                ? colors.greenAccent[700]
                : colors.greenAccent[800]
            }
            borderRadius="4px"
          >
            {access === "admin" && <AdminPanelSettingsOutlinedIcon />}
            {access === "moderator" && <SecurityOutlinedIcon />}
            {access === "user" && <LockOpenOutlinedIcon />}
            <Typography color={colors.grey[100]} sx={{ ml: "5px" }}>
              {access}
            </Typography>
          </Box>
        );
      },
    },
  ];

  return (
    <Box m="20px">
      <Header title="USER MANAGEMENT" subtitle="Managing the User Members" />
      <Box
        m="40px 0 0 0"
        height="75vh"
        sx={{
          "& .MuiDataGrid-root": {
            border: "none",
          },
          "& .MuiDataGrid-cell": {
            borderBottom: "none",
          },
          "& .name-column--cell": {
            color: colors.greenAccent[300],
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: colors.blueAccent[700],
            borderBottom: "none",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: colors.primary[400],
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: colors.blueAccent[700],
          },
          "& .MuiCheckbox-root": {
            color: `${colors.greenAccent[200]} !important`,
          },
          "& .MuiDataGrid-toolbarContainer .MuiButton-text": {
            color: `${colors.grey[100]} !important`,
          },
          // Mobile responsive grid
          "@media (max-width: 768px)": {
              "& .MuiDataGrid-columnHeaders": { display: "none" },
              "& .MuiDataGrid-row": {
                  display: "flex",
                  flexDirection: "column",
                  marginBottom: "1rem",
                  border: `1px solid ${colors.grey[700]}`,
                  borderRadius: "8px",
                  padding: "10px"
              },
              "& .MuiDataGrid-cell": {
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  borderBottom: "none",
                  padding: "5px 0"
              },
              "& .MuiDataGrid-cell:before": {
                  content: "attr(data-field)",
                  fontWeight: "bold",
                  color: colors.grey[300]
              }
          }
        }}
      >
        <DataGrid checkboxSelection rows={teamData} columns={columns} components={{ Toolbar: GridToolbar }} />
      </Box>
    </Box>
  );
};

export default Team;
