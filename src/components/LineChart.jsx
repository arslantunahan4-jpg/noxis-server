import { ResponsiveLine } from "@nivo/line";
import { useTheme } from "@mui/material";
import { tokens } from "../theme";

const LineChart = ({ isDashboard = false }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const data = [
    {
      id: "users",
      color: tokens("dark").greenAccent[500],
      data: [
        { x: "Mon", y: 12 },
        { x: "Tue", y: 35 },
        { x: "Wed", y: 45 },
        { x: "Thu", y: 32 },
        { x: "Fri", y: 65 },
        { x: "Sat", y: 78 },
        { x: "Sun", y: 95 },
      ],
    },
    {
      id: "sessions",
      color: tokens("dark").blueAccent[500],
      data: [
        { x: "Mon", y: 8 },
        { x: "Tue", y: 22 },
        { x: "Wed", y: 30 },
        { x: "Thu", y: 28 },
        { x: "Fri", y: 55 },
        { x: "Sat", y: 60 },
        { x: "Sun", y: 82 },
      ],
    },
  ];

  return (
    <ResponsiveLine
      data={data}
      theme={{
        axis: {
          domain: {
            line: {
              stroke: colors.grey[100],
            },
          },
          legend: {
            text: {
              fill: colors.grey[100],
            },
          },
          ticks: {
            line: {
              stroke: colors.grey[100],
              strokeWidth: 1,
            },
            text: {
              fill: colors.grey[100],
            },
          },
        },
        legends: {
          text: {
            fill: colors.grey[100],
          },
        },
        tooltip: {
          container: {
            color: colors.primary[500],
          },
        },
      }}
      colors={isDashboard ? { datum: "color" } : { scheme: "nivo" }}
      margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
      xScale={{ type: "point" }}
      yScale={{
        type: "linear",
        min: "auto",
        max: "auto",
        stacked: true,
        reverse: false,
      }}
      yFormat=" >-.2f"
      curve="catmullRom"
      axisTop={null}
      axisRight={null}
      axisBottom={{
        orient: "bottom",
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: isDashboard ? undefined : "Day",
        legendOffset: 36,
        legendPosition: "middle",
      }}
      axisLeft={{
        orient: "left",
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: isDashboard ? undefined : "Count",
        legendOffset: -40,
        legendPosition: "middle",
      }}
      enableGridX={false}
      enableGridY={false}
      pointSize={10}
      pointColor={{ theme: "background" }}
      pointBorderWidth={2}
      pointBorderColor={{ from: "serieColor" }}
      pointLabelYOffset={-12}
      useMesh={true}
      legends={[
        {
          anchor: "bottom-right",
          direction: "column",
          justify: false,
          translateX: 100,
          translateY: 0,
          itemsSpacing: 0,
          itemDirection: "left-to-right",
          itemWidth: 80,
          itemHeight: 20,
          itemOpacity: 0.75,
          symbolSize: 12,
          symbolShape: "circle",
          symbolBorderColor: "rgba(0, 0, 0, .5)",
          effects: [
            {
              on: "hover",
              style: {
                itemBackground: "rgba(0, 0, 0, .03)",
                itemOpacity: 1,
              },
            },
          ],
        },
      ]}
    />
  );
};

export default LineChart;
