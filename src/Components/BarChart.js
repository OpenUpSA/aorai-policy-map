import React, { useEffect } from "react";

import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { max } from "d3-array";

const BarChart = (props) => {
  useEffect(() => {
    const data = props.data;
    const containerWidth = select(".chart-" + props.chartid)
      .node()
      .getBoundingClientRect().width;
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };
    const padding = 10;
    const width = containerWidth - margin.left - margin.right;
    const barHeight = 30;

    const x = scaleLinear()
      .domain([
        0,
        max(data, (d) => d.count) > 20 ? max(data, (d) => d.count) : 20,
      ])
      .range([0, width - 20]);

    const chart = select(".chart-" + props.chartid + " svg")
      .attr("width", width)
      .attr("height", barHeight * data.length);

    const bar = chart
      .selectAll("g")
      .data(data)
      .enter()
      .append("g")
      .attr("transform", function (d, i) {
        return "translate(0," + i * barHeight + ")";
      });

    bar
      .append("rect")
      .attr("width", width)
      .attr("height", barHeight - 5)
      .attr("fill", "#f3f4f3");

    bar
      .append("rect")
      .attr("height", barHeight - 5)
      .attr("width", 0)
      .transition()
      .duration(300)
      .attr("width", function (d) {
        return x(d.count);
      })
      .attr("fill", "#3c7a77");

    bar
      .append("text")
      .attr("class", "bar-chart-label")
      .attr("x", function (d) {
        return 3;
      })
      .attr("y", barHeight / 2 - 2)
      .attr("dy", ".35em")
      .attr("fill", "#ccc")
      .text(function (d) {
        return d[props.field].substring(0, 15) + "...";
      });

    bar
      .append("text")
      .attr("class", "bar-chart-value")
      .attr("x", function (d) {
        return width - 15;
      })
      .attr("y", barHeight / 2 - 2)
      .attr("dy", ".35em")
      .text(function (d) {
        return d.count;
      });
  }, [props]);

  return (
    <div className={"chart-" + props.chartid}>
      <svg></svg>
    </div>
  );
};

export default BarChart;
