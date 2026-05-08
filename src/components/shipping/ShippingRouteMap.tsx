"use client";

import React from "react";
import { worldMill } from "@react-jvectormap/world";
import dynamic from "next/dynamic";

const VectorMap = dynamic(
  () => import("@react-jvectormap/core").then((mod) => mod.VectorMap),
  { ssr: false }
);

// Define the component props
interface ShippingRouteMapProps {
  routes: ShippingRoute[];
  mapColor?: string;
}

export interface ShippingRoute {
  id: string;
  origin: {
    country: string;
    name: string;
    latLng: [number, number];
  };
  current: {
    country: string;
    name: string;
    latLng: [number, number];
  };
  destination: {
    country: string;
    name: string;
    latLng: [number, number];
  };
}

type MarkerStyle = {
  initial: {
    fill: string;
    r: number;
  };
};

type Marker = {
  latLng: [number, number];
  name: string;
  style?: {
    fill: string;
    borderWidth: number;
    borderColor: string;
    stroke?: string;
    strokeOpacity?: number;
  };
};

const ShippingRouteMap: React.FC<ShippingRouteMapProps> = ({ routes, mapColor }) => {
  // Create markers from routes
  const createMarkers = () => {
    const markers: Marker[] = [];
    
    routes.forEach(route => {
      // Origin marker (default: China) - Red color
      markers.push({
        latLng: route.origin.latLng,
        name: `${route.origin.name} (Origin)`,
        style: {
          fill: "#e53935", // Red for origin
          borderWidth: 1,
          borderColor: "white",
          stroke: "#383f47",
        },
      });
      
      // Current position marker - Yellow color
      markers.push({
        latLng: route.current.latLng,
        name: `${route.current.name} (Current)`,
        style: {
          fill: "#ffb300", // Amber for current position
          borderWidth: 1,
          borderColor: "white",
          stroke: "#383f47",
        },
      });
      
      // Destination marker - Green color
      markers.push({
        latLng: route.destination.latLng,
        name: `${route.destination.name} (Destination)`,
        style: {
          fill: "#43a047", // Green for destination
          borderWidth: 1,
          borderColor: "white",
          stroke: "#383f47",
        },
      });
    });
    
    return markers;
  };

  return (
    <div className="relative">
      <VectorMap
        map={worldMill}
        backgroundColor="transparent"
        markerStyle={
          {
            initial: {
              fill: "#465FFF",
              r: 6, // Custom radius for markers
            },
          } as MarkerStyle
        }
        markersSelectable={true}
        markers={createMarkers() as Marker[]}
        zoomOnScroll={true}
        zoomMax={12}
        zoomMin={1}
        zoomAnimate={true}
        zoomStep={1.5}
        regionStyle={{
          initial: {
            fill: mapColor || "#D0D5DD",
            fillOpacity: 1,
            fontFamily: "Outfit",
            stroke: "none",
            strokeWidth: 0,
            strokeOpacity: 0,
          },
          hover: {
            fillOpacity: 0.7,
            cursor: "pointer",
            fill: "#1E88E5", // Primary blue
          },
          selected: {
            fill: "#1E88E5", // Primary blue
          },
          selectedHover: {},
        }}
        regionLabelStyle={{
          initial: {
            fill: "#35373e",
            fontWeight: 500,
            fontSize: "13px",
            stroke: "none",
          },
          hover: {},
          selected: {},
          selectedHover: {},
        }}
      />
      
      {/* Add overlay text for the routes */}
      <div className="absolute top-0 left-0 w-full mt-2 pl-4 text-xs text-gray-500">
        <div className="flex items-center mb-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[#e53935] mr-1"></span>
          <span>Origin</span>
          <span className="inline-block w-3 h-3 rounded-full bg-[#ffb300] mx-2 ml-4 mr-1"></span>
          <span>Current</span>
          <span className="inline-block w-3 h-3 rounded-full bg-[#43a047] mx-2 ml-4 mr-1"></span>
          <span>Destination</span>
        </div>
      </div>
    </div>
  );
};

export default ShippingRouteMap; 