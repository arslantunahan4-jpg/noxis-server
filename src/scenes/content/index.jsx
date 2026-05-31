import { Box, Typography, useTheme } from "@mui/material";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const Content = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  return (
    <Box m="20px">
      <Header title="CONTENT LIBRARY" subtitle="Manage Movies and Series" />
      <Box height="75vh" display="flex" justifyContent="center" alignItems="center">
        <Typography variant="h4" color={colors.grey[100]}>
          Content Management Module Coming Soon
        </Typography>
      </Box>
    </Box>
  );
};

export default Content;
