"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Maximize2 } from "lucide-react";
import { Paper } from "@/lib/types";

interface GraphNode {
  id: string;
  label: string;
  year?: number;
  citationCount: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  type: "current" | "citing" | "reference";
}

interface GraphLink {
  source: string;
  target: string;
}

interface CitationGraphProps {
  paper: Paper;
  onNodeClick?: (paperId: string) => void;
}

const NODE_RADIUS = 24;
const CURRENT_RADIUS = 36;
const CHAR_LIMIT = 28;

function truncateLabel(title: string, maxLen = CHAR_LIMIT): string {
  return title.length > maxLen ? title.slice(0, maxLen - 1) + "…" : title;
}

function simulateLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  centerX: number,
  centerY: number,
  width: number,
  height: number
): GraphNode[] {
  const nodes_copy = nodes.map((n) => ({
    ...n,
    x: centerX + (Math.random() - 0.5) * width * 0.8,
    y: centerY + (Math.random() - 0.5) * height * 0.8,
    vx: 0,
    vy: 0,
  }));

  const ITERATIONS = 120;
  const REPULSION = 4000;
  const ATTRACTION = 0.06;
  const CENTER_FORCE = 0.018;
  const DAMPING = 0.85;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < nodes_copy.length; i++) {
      const a = nodes_copy[i];
      a.vx! *= DAMPING;
      a.vy! *= DAMPING;

      // Repulsion between all pairs
      for (let j = 0; j < nodes_copy.length; j++) {
        if (i === j) continue;
        const b = nodes_copy[j];
        const dx = a.x! - b.x!;
        const dy = a.y! - b.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);
        a.vx! += (dx / dist) * force;
        a.vy! += (dy / dist) * force;
      }
    }

    // Attraction along links
    for (const link of links) {
      const si = nodes_copy.findIndex((n) => n.id === link.source);
      const ti = nodes_copy.findIndex((n) => n.id === link.target);
      if (si < 0 || ti < 0) continue;
      const a = nodes_copy[si];
      const b = nodes_copy[ti];
      const dx = b.x! - a.x!;
      const dy = b.y! - a.y!;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 90) * ATTRACTION;
      a.vx! += (dx / dist) * force;
      a.vy! += (dy / dist) * force;
      b.vx! -= (dx / dist) * force;
      b.vy! -= (dy / dist) * force;
    }

    // Center force
    for (const n of nodes_copy) {
      n.vx! += (centerX - n.x!) * CENTER_FORCE;
      n.vy! += (centerY - n.y!) * CENTER_FORCE;
    }

    // Integrate
    for (const n of nodes_copy) {
      n.x! += n.vx!;
      n.y! += n.vy!;
    }
  }

  return nodes_copy;
}

export function CitationGraph({ paper, onNodeClick }: CitationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 480, height: 320 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const activeContainerRef = fullscreen ? fullscreenContainerRef : containerRef;
  const [citingPapers, setCitingPapers] = useState<
    { paperId: string; title: string; year?: number; citationCount: number }[]
  >([]);
  const [referencePapers, setReferencePapers] = useState<
    { paperId: string; title: string; year?: number; citationCount: number }[]
  >([]);

  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(width, 240), height: Math.max(height, 200) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Measure fullscreen container
  useEffect(() => {
    if (!fullscreen) return;
    const el = fullscreenContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(width, 400), height: Math.max(height, 300) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullscreen]);

  // Fetch graph data
  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paper.paperId}/citations?fields=title,year,citationCount&limit=8`
      ).then((r) => r.json()),
      fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paper.paperId}/references?fields=title,year,citationCount&limit=8`
      ).then((r) => r.json()),
    ])
      .then(([citingData, refData]) => {
        const citing: typeof citingPapers = (citingData.data || []).map(
          (d: { paperId: string; title: string; year?: number; citationCount: number }) => ({
            paperId: d.paperId,
            title: d.title,
            year: d.year,
            citationCount: d.citationCount || 0,
          })
        );
        const refs: typeof referencePapers = (refData.data || []).map(
          (d: { paperId: string; title: string; year?: number; citationCount: number }) => ({
            paperId: d.paperId,
            title: d.title,
            year: d.year,
            citationCount: d.citationCount || 0,
          })
        );
        setCitingPapers(citing);
        setReferencePapers(refs);

        const graphNodes: GraphNode[] = [
          {
            id: paper.paperId,
            label: truncateLabel(paper.title),
            year: paper.year,
            citationCount: paper.citationCount || 0,
            type: "current",
          },
          ...citing.map((c) => ({
            id: c.paperId,
            label: truncateLabel(c.title),
            year: c.year,
            citationCount: c.citationCount,
            type: "citing" as const,
          })),
          ...refs.map((r) => ({
            id: r.paperId,
            label: truncateLabel(r.title),
            year: r.year,
            citationCount: r.citationCount,
            type: "reference" as const,
          })),
        ];

        const graphLinks: GraphLink[] = [
          ...citing.map((c) => ({ source: c.paperId, target: paper.paperId })),
          ...refs.map((r) => ({ source: paper.paperId, target: r.paperId })),
        ];

        const laidOut = simulateLayout(graphNodes, graphLinks, centerX, centerY, dimensions.width, dimensions.height);
        setNodes(laidOut);
        setLinks(graphLinks);
      })
      .catch(() => {
        setNodes([]);
        setLinks([]);
      })
      .finally(() => setIsLoading(false));
  }, [paper.paperId, paper.title, paper.year, paper.citationCount, centerX, centerY, dimensions.width, dimensions.height]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNode((prev) => (prev === nodeId ? null : nodeId));
      if (nodeId !== paper.paperId && onNodeClick) {
        onNodeClick(nodeId);
      }
    },
    [paper.paperId, onNodeClick]
  );

  const nodeColor = (type: GraphNode["type"]) => {
    if (type === "current") return "#2563eb";
    if (type === "citing") return "#10b981";
    return "#f59e0b";
  };

  const nodeRadius = (type: GraphNode["type"]) => {
    if (type === "current") return CURRENT_RADIUS;
    return NODE_RADIUS;
  };

  return (
    <>
      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black/60">
            <div className="text-white text-sm font-medium">Citation Graph — {paper.title}</div>
            <button
              onClick={() => setFullscreen(false)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div ref={fullscreenContainerRef} className="flex-1 w-full min-h-0" />
        </div>
      )}

      <div ref={containerRef} className="relative w-full h-full min-h-[200px]">
        {/* Fullscreen button */}
        {!isLoading && nodes.length > 0 && (
          <button
            onClick={() => setFullscreen(true)}
            className="absolute top-2 left-2 p-1.5 rounded-md bg-white/80 hover:bg-white text-slate-500 hover:text-slate-700 transition-colors z-10"
            title="View fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Building citation graph…</p>
          </div>
        </div>
      )}

      {!isLoading && nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-slate-400">No citation data available</p>
        </div>
      )}

      {!isLoading && nodes.length > 0 && (
        <svg width={dimensions.width} height={dimensions.height} className="w-full h-full">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="6"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Links */}
          {links.map((link, i) => {
            const source = nodes.find((n) => n.id === link.source);
            const target = nodes.find((n) => n.id === link.target);
            if (!source || !target) return null;
            const isHighlighted =
              hoveredNode === link.source || hoveredNode === link.target;
            return (
              <line
                key={i}
                x1={source.x} y1={source.y}
                x2={target.x} y2={target.y}
                stroke={isHighlighted ? "#64748b" : "#cbd5e1"}
                strokeWidth={isHighlighted ? 1.5 : 0.75}
                markerEnd="url(#arrowhead)"
                opacity={isHighlighted ? 1 : 0.5}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const radius = nodeRadius(node.type);
            const color = nodeColor(node.type);
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode === node.id;
            const fullPaper =
              node.id === paper.paperId
                ? paper
                : citingPapers.find((c) => c.paperId === node.id) ||
                  referencePapers.find((r) => r.paperId === node.id);

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  setHoveredNode(node.id);
                  const rect = activeContainerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      text: fullPaper?.title || node.label,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  setTooltip(null);
                }}
                onClick={() => handleNodeClick(node.id)}
              >
                {/* Outer ring for current node */}
                {node.type === "current" && (
                  <circle
                    r={radius + 5}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    opacity={0.35}
                  />
                )}

                {/* Glow for selected */}
                {isSelected && (
                  <circle
                    r={radius + 8}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    filter="url(#glow)"
                    opacity={0.6}
                  />
                )}

                {/* Main circle */}
                <circle
                  r={radius}
                  fill={color}
                  opacity={isHovered || isSelected ? 1 : 0.8}
                  stroke={isHovered || isSelected ? "white" : "transparent"}
                  strokeWidth={isHovered || isSelected ? 2 : 0}
                />

                {/* Year label */}
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={node.type === "current" ? 11 : 9}
                  fontWeight={node.type === "current" ? "700" : "500"}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {node.year || "—"}
                </text>

                {/* Type indicator dot */}
                <circle
                  cx={radius - 6}
                  cy={-radius + 6}
                  r={3}
                  fill="white"
                  opacity={0.8}
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 max-w-[220px] shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      {!isLoading && nodes.length > 0 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" /> This paper
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Citing
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> References
          </span>
        </div>
      )}
    </div>
    </>
  );
}
