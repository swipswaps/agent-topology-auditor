import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function ProvenanceD3Graph({ architecture }) {
  const svgRef = useRef(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !architecture) return;

    const width = 640;
    const height = 390;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).style('width', '100%').style('height', '100%');

    const defs = svg.append('defs');
    const markerColors = {
      safe: '#10b981',
      medium: '#f59e0b',
      high: '#f43f5e',
    };

    Object.entries(markerColors).forEach(([risk, color]) => {
      defs
        .append('marker')
        .attr('id', `arrow-${risk}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 22)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color);
    });

    const nodeMap = new Map(architecture.nodes.map((n) => [n.id, n]));

    const linkGroup = svg.append('g');
    architecture.links.forEach((lnk) => {
      const src = nodeMap.get(lnk.source);
      const dst = nodeMap.get(lnk.target);
      if (!src || !dst) return;

      const color = markerColors[lnk.risk] || '#9fb0cc';
      linkGroup
        .append('line')
        .attr('x1', src.x)
        .attr('y1', src.y)
        .attr('x2', dst.x)
        .attr('y2', dst.y)
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', lnk.risk === 'high' ? '5,4' : 'none')
        .attr('marker-end', `url(#arrow-${lnk.risk})`);

      const midX = (src.x + dst.x) / 2;
      const midY = (src.y + dst.y) / 2 - 7;
      linkGroup
        .append('text')
        .attr('x', midX)
        .attr('y', midY)
        .attr('text-anchor', 'middle')
        .attr('fill', color)
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, monospace')
        .text(lnk.label);
    });

    const groupColors = {
      trusted: '#10b981',
      compute: '#38bdf8',
      bridge: '#f59e0b',
      vulnerable: '#f43f5e',
    };

    const nodeGroup = svg
      .selectAll('.node')
      .data(architecture.nodes)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

    nodeGroup
      .append('circle')
      .attr('r', 15)
      .attr('fill', '#121826')
      .attr('stroke', (d) => groupColors[d.group] || '#38bdf8')
      .attr('stroke-width', 2.5);

    nodeGroup
      .append('text')
      .attr('y', 29)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e6edf7')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text((d) => d.label);
  }, [architecture]);

  return (
    <div className="canvas-container">
      <svg ref={svgRef} />
    </div>
  );
}
