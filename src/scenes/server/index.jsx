import { Box, Typography, useTheme } from "@mui/material";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const ServerStatus = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  return (
    <Box m="20px">
      <Header title="SERVER STATUS" subtitle="Monitor System Health" />
      <Box height="75vh" display="flex" justifyContent="center" alignItems="center">
        <Typography variant="h4" color={colors.grey[100]}>
          System Monitor Module Coming Soon
        </Typography>
      </Box>
    </Box>
  );
};

export default ServerStatus;
