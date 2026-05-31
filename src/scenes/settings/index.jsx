import { Box, Typography, useTheme } from "@mui/material";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const Settings = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  return (
    <Box m="20px">
      <Header title="SETTINGS" subtitle="Configure System Preferences" />
      <Box height="75vh" display="flex" justifyContent="center" alignItems="center">
        <Typography variant="h4" color={colors.grey[100]}>
          Settings Module Coming Soon
        </Typography>
      </Box>
    </Box>
  );
};

export default Settings;
