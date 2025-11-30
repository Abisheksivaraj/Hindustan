import React, { useState } from "react";
import { FileText, Eye, RefreshCw } from "lucide-react";

export default function TSPLConverter() {
  const [tsplCode, setTsplCode] = useState(`SIZE 100 mm, 60 mm
GAP 2 mm, 0 mm
DIRECTION 1
REFERENCE 0,0
CLS
TEXT 50,50,"3",0,1,1,"Hello World"
TEXT 50,100,"2",0,1,1,"TSPL Label Design"
BARCODE 50,150,"128",60,1,0,2,2,"12345678"
QRCODE 250,50,H,4,A,0,"https://example.com"
BOX 40,40,450,250,2
PRINT 1,1`);
  const [labelElements, setLabelElements] = useState([]);
  const [labelSize, setLabelSize] = useState({ width: 400, height: 240 });

  const parseTSPL = (code) => {
    const lines = code
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
    const elements = [];
    let width = 400,
      height = 240;

    lines.forEach((line) => {
      const parts = line.split(/[\s,]+/);
      const command = parts[0].toUpperCase();

      // Parse SIZE command
      if (command === "SIZE") {
        const w = parseFloat(parts[1]);
        const h = parseFloat(parts[3]);
        // Convert mm to pixels: 1 inch = 96 pixels, 1 inch = 25.4 mm
        // So: pixels = mm * (96 / 25.4) ≈ mm * 3.78
        width = w * 3.78;
        height = h * 3.78;
      }

      // Parse TEXT command
      if (command === "TEXT") {
        const x = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        // const font = parts[3].replace(/"/g, '');
        const rotation = parseInt(parts[4]);
        // const xMul = parseInt(parts[5]);
        const yMul = parseInt(parts[6]);
        const text =
          line
            .match(/"([^"]*)"/g)
            ?.pop()
            ?.replace(/"/g, "") || "";

        elements.push({
          type: "text",
          x,
          y,
          rotation,
          text,
          fontSize: Math.max(12, yMul * 8),
        });
      }

      // Parse BARCODE command
      if (command === "BARCODE") {
        const x = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        const type = parts[3].replace(/"/g, "");
        const height = parseInt(parts[4]);
        const data =
          line
            .match(/"([^"]*)"/g)
            ?.pop()
            ?.replace(/"/g, "") || "";

        elements.push({
          type: "barcode",
          x,
          y,
          height,
          data,
          barcodeType: type,
        });
      }

      // Parse QRCODE command
      if (command === "QRCODE") {
        const x = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        const size = parseInt(parts[4]) * 10;
        const data =
          line
            .match(/"([^"]*)"/g)
            ?.pop()
            ?.replace(/"/g, "") || "";

        elements.push({
          type: "qrcode",
          x,
          y,
          size,
          data,
        });
      }

      // Parse BOX command
      if (command === "BOX") {
        const x1 = parseInt(parts[1]);
        const y1 = parseInt(parts[2]);
        const x2 = parseInt(parts[3]);
        const y2 = parseInt(parts[4]);
        const thickness = parseInt(parts[5]) || 1;

        elements.push({
          type: "box",
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
          thickness,
        });
      }

      // Parse REVERSE command (filled rectangle)
      if (command === "REVERSE") {
        const x = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        const width = parseInt(parts[3]);
        const height = parseInt(parts[4]);

        elements.push({
          type: "reverse",
          x,
          y,
          width,
          height,
        });
      }
    });

    setLabelSize({ width, height });
    setLabelElements(elements);
  };

  const handleConvert = () => {
    parseTSPL(tsplCode);
  };

  const renderElement = (element, index) => {
    const scale = 1; // Changed from 0.8 to 1 for actual size

    switch (element.type) {
      case "text":
        return (
          <text
            key={index}
            x={element.x * scale}
            y={element.y * scale}
            fontSize={element.fontSize}
            fill="#000"
            fontFamily="monospace"
            transform={`rotate(${element.rotation}, ${element.x * scale}, ${
              element.y * scale
            })`}
          >
            {element.text}
          </text>
        );

      case "barcode":
        return (
          <g key={index}>
            <rect
              x={element.x * scale}
              y={element.y * scale}
              width={element.data.length * 8}
              height={element.height * scale}
              fill="url(#barcodePattern)"
            />
            <text
              x={element.x * scale}
              y={(element.y + element.height + 15) * scale}
              fontSize="10"
              fill="#000"
              fontFamily="monospace"
            >
              {element.data}
            </text>
          </g>
        );

      case "qrcode":
        return (
          <g key={index}>
            <rect
              x={element.x * scale}
              y={element.y * scale}
              width={element.size}
              height={element.size}
              fill="url(#qrcodePattern)"
              stroke="#000"
              strokeWidth="1"
            />
            <text
              x={element.x * scale + element.size / 2}
              y={element.y * scale + element.size / 2}
              fontSize="8"
              fill="#666"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              QR
            </text>
          </g>
        );

      case "box":
        return (
          <rect
            key={index}
            x={element.x * scale}
            y={element.y * scale}
            width={element.width * scale}
            height={element.height * scale}
            fill="none"
            stroke="#000"
            strokeWidth={element.thickness}
          />
        );

      case "reverse":
        return (
          <rect
            key={index}
            x={element.x * scale}
            y={element.y * scale}
            width={element.width * scale}
            height={element.height * scale}
            fill="#000"
          />
        );

      default:
        return null;
    }
  };

  React.useEffect(() => {
    parseTSPL(tsplCode);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            <FileText className="w-10 h-10 text-indigo-600" />
            TSPL Label Converter
          </h1>
          <p className="text-gray-600">
            Convert TSPL printer code to visual label design
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">TSPL Code</h2>
              <button
                onClick={handleConvert}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Convert
              </button>
            </div>
            <textarea
              value={tsplCode}
              onChange={(e) => setTsplCode(e.target.value)}
              className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter TSPL code here..."
            />
          </div>

          {/* Preview Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-800">
                Label Preview
              </h2>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 flex items-center justify-center min-h-96">
              <svg
                width={labelSize.width}
                height={labelSize.height}
                className="bg-white shadow-md"
                style={{ border: "1px solid #e5e7eb" }}
              >
                <defs>
                  <pattern
                    id="barcodePattern"
                    patternUnits="userSpaceOnUse"
                    width="4"
                    height="10"
                  >
                    <rect width="2" height="10" fill="#000" />
                    <rect x="2" width="2" height="10" fill="#fff" />
                  </pattern>
                  <pattern
                    id="qrcodePattern"
                    patternUnits="userSpaceOnUse"
                    width="4"
                    height="4"
                  >
                    <rect width="2" height="2" fill="#000" />
                    <rect x="2" y="2" width="2" height="2" fill="#000" />
                  </pattern>
                </defs>
                {labelElements.map((element, index) =>
                  renderElement(element, index)
                )}
              </svg>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>
                Dimensions: {Math.round(labelSize.width)} ×{" "}
                {Math.round(labelSize.height)} px
              </p>
              <p>
                Dimensions (inches): {(labelSize.width / 96).toFixed(2)}" ×{" "}
                {(labelSize.height / 96).toFixed(2)}"
              </p>
              <p>Elements: {labelElements.length}</p>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Supported TSPL Commands
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <strong>SIZE</strong> - Label dimensions
            </div>
            <div>
              <strong>TEXT</strong> - Text elements
            </div>
            <div>
              <strong>BARCODE</strong> - Barcode generation
            </div>
            <div>
              <strong>QRCODE</strong> - QR code generation
            </div>
            <div>
              <strong>DMATRIX</strong> - DataMatrix codes
            </div>
            <div>
              <strong>BOX</strong> - Rectangle borders
            </div>
            <div>
              <strong>REVERSE</strong> - Filled rectangles
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
