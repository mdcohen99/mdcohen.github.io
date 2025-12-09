
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { NetworkData } from '../types';

interface Props {
  data: NetworkData;
  onNodeClick: (id: string) => void;
  width?: number;
  height?: number;
  mode?: 'tree' | 'cluster';
}

const NetworkGraph: React.FC<Props> = ({ data, onNodeClick, width = 800, height = 600, mode = 'tree' }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Create a container group for zooming
    const container = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Create a mutable copy of the data for d3 to modify
    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.links.map(d => ({ ...d }));

    // Define colors based on group
    const getColor = (group: number) => {
      switch(group) {
        case 0: return "#0ea5e9"; // Focus / HC (Blue)
        case 1: return "#f97316"; // Mentor (Orange)
        case 2: return "#10b981"; // Protege (Green)
        case 3: return "#94a3b8"; // Colleague (Slate)
        default: return "#cbd5e1";
      }
    };

    // Setup Simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(mode === 'tree' ? 100 : 50))
      .force("charge", d3.forceManyBody().strength(mode === 'tree' ? -400 : -200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.radius + (mode === 'tree' ? 20 : 5)).iterations(2));

    // Conditional Forces
    if (mode === 'tree') {
      // Tree hierarchy vertical positioning
      simulation.force("y", d3.forceY().y((d: any) => {
        if (d.group === 1) return height * 0.2; // Mentors top
        if (d.group === 2) return height * 0.8; // Proteges bottom
        return height * 0.5; // Focus and Colleagues middle
      }).strength(0.3));
    } else {
      // Global cluster tweaks
      // We rely on charge and center mainly, maybe a weak x/y to keep it loosely centered
      simulation.force("x", d3.forceX(width / 2).strength(0.01));
      simulation.force("y", d3.forceY(height / 2).strength(0.01));
    }

    // Add arrow markers for links ONLY in tree mode
    if (mode === 'tree') {
      svg.append("defs").selectAll("marker")
        .data(["end"])
        .enter().append("marker")
        .attr("id", String)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#94a3b8");
    }

    const link = container.append("g")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d: any) => Math.sqrt(d.value || 1));

    const node = container.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    // Node Circle
    node.append("circle")
      .attr("r", (d: any) => d.radius)
      .attr("fill", (d: any) => getColor(d.group))
      .attr("stroke", "#fff")
      .attr("stroke-width", mode === 'tree' ? 2 : 1)
      .attr("cursor", "pointer")
      .on("click", (event, d: any) => {
        // Prevent drag click interference
        if (event.defaultPrevented) return;
        onNodeClick(d.id);
      })
      .append("title")
        .text((d: any) => `${d.id}\n${d.role || ''}`);

    // Labels
    if (mode === 'tree') {
      node.append("text")
        .attr("dy", (d: any) => d.radius + 15)
        .attr("text-anchor", "middle")
        .text((d: any) => d.id)
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("fill", "#334155")
        .style("pointer-events", "none")
        .style("text-shadow", "0 1px 2px rgba(255,255,255,0.8)");
    } else {
      // In global mode, only show labels on hover or for large nodes? 
      // For now, let's skip text to avoid clutter or only show for "Head Coaches" (group 0)
       node.filter((d: any) => d.group === 0)
        .append("text")
        .attr("dy", -10)
        .attr("text-anchor", "middle")
        .text((d: any) => d.id)
        .style("font-size", "10px")
        .style("fill", "#475569")
        .style("opacity", 0.8)
        .style("pointer-events", "none");
    }

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Initial Zoom out slightly for global graph
    if (mode === 'cluster') {
        const initialScale = 0.6;
        svg.call(zoom.transform as any, d3.zoomIdentity.translate(width/2, height/2).scale(initialScale).translate(-width/2, -height/2));
    }

    return () => {
      simulation.stop();
    };
  }, [data, width, height, onNodeClick, mode]);

  return (
    <div className="w-full h-full bg-slate-50/50 overflow-hidden">
      <svg ref={svgRef} width={width} height={height} className="w-full h-full block" />
    </div>
  );
};

export default NetworkGraph;
