import { Box, Button, IconButton, Typography, useTheme } from "@mui/material";
import { tokens } from "../../theme";
import Header from "../../components/Header";
import LineChart from "../../components/LineChart"; // Import the new chart
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import TrafficIcon from "@mui/icons-material/Traffic";
import RefreshIcon from "@mui/icons-material/Refresh";
import SecurityIcon from "@mui/icons-material/Security";
import { useEffect, useState } from "react";

const StatBox = ({ title, subtitle, icon, increase, color }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  return (
    <Box width="100%" m="0 30px">
      <Box display="flex" justifyContent="space-between">
        <Box>
          {icon}
          <Typography
            variant="h4"
            fontWeight="bold"
            sx={{ color: colors.grey[100] }}
            className="stat-value"
          >
            {title}
          </Typography>
        </Box>
        <Box>
          <div style={{ 
              background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
              width: '40px', height: '40px', borderRadius: '50%', position: 'absolute' 
          }} />
        </Box>
      </Box>
      <Box display="flex" justifyContent="space-between" mt="2px">
        <Typography variant="h5" sx={{ color: color }}>
          {subtitle}
        </Typography>
        <Typography
          variant="h5"
          fontStyle="italic"
          sx={{ color: colors.greenAccent[600] }}
        >
          {increase}
        </Typography>
      </Box>
    </Box>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [stats, setStats] = useState({
      userCount: 0,
      sessionCount: 0,
      newUsersToday: 0,
      recentUsers: []
  });

  const fetchStats = async () => {
      try {
          const token = localStorage.getItem('noxis_auth_token');
          const res = await fetch('/api/admin/stats', {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
              const data = await res.json();
              if (data.success && data.stats) {
                  setStats({
                      userCount: data.stats.users?.total || 0,
                      sessionCount: data.stats.sessions?.activeToday || 0,
                      newUsersToday: data.stats.users?.newToday || 0,
                      recentUsers: data.stats.recentLogins || []
                  });
              }
          }
      } catch (e) {
          console.error("Stats fetch error", e);
      }
  };

  useEffect(() => {
      fetchStats();
      const interval = setInterval(fetchStats, 10000); // Live update every 10s
      return () => clearInterval(interval);
  }, []);

  return (
    <Box m="20px">
      {/* HEADER */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header title="DASHBOARD" subtitle="Noxis System Overview" />

        <Box>
          <Button
            sx={{
              backgroundColor: colors.blueAccent[700],
              color: colors.grey[100],
              fontSize: "14px",
              fontWeight: "bold",
              padding: "10px 20px",
              marginRight: "10px",
            }}
          >
            <DownloadOutlinedIcon sx={{ mr: "10px" }} />
            Download Reports
          </Button>
          <IconButton onClick={fetchStats} sx={{ color: colors.greenAccent[500], background: 'rgba(255,255,255,0.1)' }}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* GRID & CHARTS */}
      <Box
        display="grid"
        gridTemplateColumns="repeat(12, 1fr)"
        gridAutoRows="140px"
        gap="20px"
      >
        {/* ROW 1 */}
        {/* Total Users */}
        <Box
          gridColumn="span 3"
          display="flex"
          alignItems="center"
          justifyContent="center"
          className="glass-card"
        >
          <StatBox
            title={stats.userCount}
            subtitle="Total Users"
            progress="0.75"
            increase={`+${stats.newUsersToday} Today`}
            icon={
              <PersonAddIcon
                sx={{ color: colors.greenAccent[600], fontSize: "26px" }}
              />
            }
            color={colors.greenAccent[500]}
          />
        </Box>

        {/* Active Sessions */}
        <Box
          gridColumn="span 3"
          display="flex"
          alignItems="center"
          justifyContent="center"
          className="glass-card"
        >
          <StatBox
            title={stats.sessionCount}
            subtitle="Active Sessions"
            increase="Online"
            icon={
              <TrafficIcon
                sx={{ color: colors.blueAccent[600], fontSize: "26px" }}
              />
            }
            color={colors.blueAccent[500]}
          />
        </Box>

        {/* Security Status */}
        <Box
          gridColumn="span 3"
          display="flex"
          alignItems="center"
          justifyContent="center"
          className="glass-card"
        >
          <StatBox
            title="Active"
            subtitle="Security Shield"
            increase="Secured"
            icon={
              <SecurityIcon
                sx={{ color: colors.redAccent[600], fontSize: "26px" }}
              />
            }
            color={colors.redAccent[500]}
          />
        </Box>

         {/* Last Signup Info */}
         <Box
          gridColumn="span 3"
          display="flex"
          alignItems="center"
          justifyContent="center"
          className="glass-card"
        >
           <Box textAlign="center">
              <Typography variant="h5" color={colors.grey[100]} fontWeight="bold">
                  Last Signup
              </Typography>
              <Typography variant="h3" color={colors.greenAccent[500]} mt="10px">
                  {stats.recentUsers[0]?.username || '-'}
              </Typography>
              <Typography variant="body2" color={colors.grey[300]}>
                  {stats.recentUsers[0] ? new Date(stats.recentUsers[0].createdAt).toLocaleTimeString() : ''}
              </Typography>
           </Box>
        </Box>

        {/* ROW 2 - Line Chart */}
        <Box
          gridColumn="span 8"
          gridRow="span 2"
          className="glass-card"
        >
          <Box
            mt="25px"
            p="0 30px"
            display="flex "
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Typography
                variant="h5"
                fontWeight="600"
                color={colors.grey[100]}
              >
                Traffic Overview
              </Typography>
              <Typography
                variant="h3"
                fontWeight="bold"
                color={colors.greenAccent[500]}
              >
                Users & Sessions
              </Typography>
            </Box>
            <Box>
              <IconButton>
                <DownloadOutlinedIcon
                  sx={{ fontSize: "26px", color: colors.greenAccent[500] }}
                />
              </IconButton>
            </Box>
          </Box>
          <Box height="250px" m="-20px 0 0 0">
            <LineChart isDashboard={true} />
          </Box>
        </Box>

        {/* ROW 2 - Recent Users Table */}
        <Box
          gridColumn="span 4"
          gridRow="span 2"
          className="glass-card"
          overflow="auto"
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            borderBottom={`4px solid ${colors.primary[500]}`}
            p="15px"
          >
            <Typography color={colors.grey[100]} variant="h5" fontWeight="600">
              New Members
            </Typography>
          </Box>
          {stats.recentUsers.map((user, i) => (
            <Box
              key={`${user.username}-${i}`}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              borderBottom={`1px solid rgba(255,255,255,0.1)`}
              p="15px"
            >
              <Box>
                <Typography
                  color={colors.greenAccent[500]}
                  variant="h5"
                  fontWeight="600"
                >
                  {user.username}
                </Typography>
                <Typography color={colors.grey[100]} fontSize="0.8rem">
                  {user.email || 'No Email'}
                </Typography>
              </Box>
              <Box
                backgroundColor={colors.greenAccent[500]}
                p="5px 10px"
                borderRadius="4px"
                fontSize="0.8rem"
              >
                {user.role}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
