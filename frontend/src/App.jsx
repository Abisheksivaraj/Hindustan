import React, { useState, useEffect, useRef } from "react";
import { Printer, Bluetooth, Download, Search } from "lucide-react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import bwipjs from "bwip-js";

const App = () => {
  const [baseName, setBaseName] = useState("PA00001");
  const [quantity, setQuantity] = useState(10);
  const [codeType, setCodeType] = useState("barcode");
  const [generatedCodes, setGeneratedCodes] = useState([]);
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [status, setStatus] = useState("");
  const [printerChar, setPrinterChar] = useState(null);

  const generateSequence = () => {
    const codes = [];
    const match = baseName.match(/^(.+?)(\d+)$/);

    if (!match) {
      alert("Please enter a name ending with numbers (e.g., PA00001)");
      return;
    }

    const prefix = match[1];
    const startNum = parseInt(match[2]);
    const numLength = match[2].length;

    for (let i = 0; i < quantity; i++) {
      const currentNum = startNum + i;
      const paddedNum = String(currentNum).padStart(numLength, "0");
      codes.push(prefix + paddedNum);
    }

    setGeneratedCodes(codes);
  };

  const connectBluetoothPrinter = async () => {
    try {
      if (!navigator.bluetooth) {
        alert("Web Bluetooth is not supported on this browser/device");
        return;
      }

      setStatus("Requesting Bluetooth device...");

      // Request device - accept all to see available printers
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb", // Generic printer
          "49535343-fe7d-4ae5-8fa9-9fafd205e455", // SPP-like service
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Nordic UART
          "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Another Nordic UART
        ],
      });

      setStatus("Connecting to printer...");
      const server = await device.gatt.connect();

      setStatus("Discovering services...");
      const services = await server.getPrimaryServices();

      let foundChar = null;

      // Try to find a writable characteristic
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              foundChar = char;
              setStatus(
                `Found writable characteristic: ${char.uuid.substring(0, 8)}...`
              );
              break;
            }
          }
          if (foundChar) break;
        } catch (e) {
          console.log("Service check error:", e);
        }
      }

      if (!foundChar) {
        throw new Error(
          "No writable characteristic found. Printer may not be compatible."
        );
      }

      setPrinterChar(foundChar);
      setBluetoothDevice(device);
      setIsConnected(true);
      setStatus(`✅ Connected to ${device.name || "Printer"}`);
    } catch (error) {
      console.error("Bluetooth error:", error);
      setStatus(`❌ Error: ${error.message}`);
      alert("Failed to connect: " + error.message);
    }
  };

  const disconnectPrinter = () => {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      bluetoothDevice.gatt.disconnect();
      setBluetoothDevice(null);
      setPrinterChar(null);
      setIsConnected(false);
      setStatus("Disconnected");
    }
  };

  const generateTSPLCommand = (code) => {
    let tspl = "";

    tspl += `SIZE 50 mm, 50 mm\r\n`;
    tspl += `GAP 2 mm, 0 mm\r\n`;
    tspl += `DIRECTION 0\r\n`;
    tspl += `REFERENCE 0,0\r\n`;
    tspl += `OFFSET 0 mm\r\n`;
    tspl += `SET PEEL OFF\r\n`;
    tspl += `SET CUTTER OFF\r\n`;
    tspl += `SET PARTIAL_CUTTER OFF\r\n`;
    tspl += `SET TEAR ON\r\n`;
    tspl += `CLS\r\n`;
    tspl += `BOX 8,8,376,376,2\r\n`;

    if (codeType === "barcode") {
      tspl += `BARCODE 92,120,"128",70,1,0,2,2,"${code}"\r\n`;
      tspl += `TEXT 132,200,"3",0,1,1,"${code}"\r\n`;
    } else if (codeType === "qrcode") {
      tspl += `QRCODE 130,90,H,5,A,0,"${code}"\r\n`;
      tspl += `TEXT 152,220,"3",0,1,1,"${code}"\r\n`;
    } else if (codeType === "datamatrix") {
      tspl += `DMATRIX 120,90,140,140,"${code}"\r\n`;
      tspl += `TEXT 152,220,"3",0,1,1,"${code}"\r\n`;
    }

    tspl += `PRINT 1,1\r\n`;
    return tspl;
  };

  const printViaBluetooth = async () => {
    if (!isConnected || !printerChar) {
      alert("Please connect to printer first");
      return;
    }

    if (generatedCodes.length === 0) {
      alert("Please generate codes first");
      return;
    }

    setIsPrinting(true);
    const encoder = new TextEncoder();

    try {
      for (let i = 0; i < generatedCodes.length; i++) {
        const code = generatedCodes[i];
        setStatus(`Printing ${i + 1}/${generatedCodes.length}...`);

        const tsplCommand = generateTSPLCommand(code);
        const data = encoder.encode(tsplCommand);

        // Split data into chunks if needed (some printers have MTU limits)
        const chunkSize = 512;
        for (let offset = 0; offset < data.length; offset += chunkSize) {
          const chunk = data.slice(offset, offset + chunkSize);
          if (printerChar.properties.writeWithoutResponse) {
            await printerChar.writeValueWithoutResponse(chunk);
          } else {
            await printerChar.writeValue(chunk);
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      setStatus(`✅ Successfully printed ${generatedCodes.length} labels!`);
      alert(`Successfully printed ${generatedCodes.length} labels!`);
    } catch (error) {
      console.error("Print error:", error);
      setStatus(`❌ Print error: ${error.message}`);
      alert("Failed to print: " + error.message);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleBrowserPrint = () => {
    if (generatedCodes.length === 0) {
      alert("Please generate codes first");
      return;
    }
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: 50mm 50mm;
            margin: 0;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-grid {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .print-item {
            width: 50mm !important;
            height: 50mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            padding: 2mm !important;
            border: 2px solid #000000 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            background: white !important;
            margin: 0 !important;
          }
          
          .print-item:last-child {
            page-break-after: auto !important;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          h1, h2, h3, h4, h5, h6 {
            display: none !important;
          }
        }
        
        .label-preview {
          width: 100%;
          aspect-ratio: 1;
          max-width: 189px;
          border: 2px solid #000000 !important;
        }

        body::-webkit-scrollbar {
          width: 8px;
        }
        
        body::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        body::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }
        
        body::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-[1550px] mx-auto w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
              TSC Alpha 40L - Android Bluetooth
            </h1>

            <div className="no-print flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {isConnected ? (
                <div className="flex items-center gap-2 w-full sm:w-auto bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm text-green-700 font-medium">
                    Connected
                  </span>
                  <button
                    onClick={disconnectPrinter}
                    className="ml-auto sm:ml-2 px-2 sm:px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectBluetoothPrinter}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base w-full sm:w-auto"
                >
                  <Bluetooth size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span className="whitespace-nowrap">Connect Bluetooth</span>
                </button>
              )}
            </div>
          </div>

          {status && (
            <div className="no-print bg-blue-50 border border-blue-300 rounded-lg p-3 mb-4 text-sm">
              <strong>Status:</strong> {status}
            </div>
          )}

          <div className="no-print bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-3 mb-4 text-xs sm:text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">📱</span>
              <div>
                <strong className="text-green-900">
                  Android Chrome Compatible
                </strong>
                <p className="text-green-800 mt-1">
                  Uses Web Bluetooth API - works on Android Chrome. Connect to
                  your TSC printer and print directly!
                </p>
              </div>
            </div>
          </div>

          <div className="no-print bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 lg:mb-8">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Base Name
                </label>
                <input
                  type="text"
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  placeholder="PA00001"
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must end with numbers (e.g., PA00001, ITEM001)
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  min="1"
                  max="1000"
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Code Type
                </label>
                <select
                  value={codeType}
                  onChange={(e) => setCodeType(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="barcode">Barcode (Code128)</option>
                  <option value="qrcode">QR Code</option>
                  <option value="datamatrix">Data Matrix</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3 text-xs sm:text-sm text-blue-800">
                <strong>Label Size:</strong> 50mm × 50mm with 2mm border
              </div>

              <button
                onClick={generateSequence}
                className="w-full bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
              >
                Generate Labels
              </button>

              {generatedCodes.length > 0 && (
                <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t">
                  <h3 className="font-semibold text-gray-800 text-sm sm:text-base">
                    Print Options:
                  </h3>

                  <button
                    onClick={printViaBluetooth}
                    disabled={!isConnected || isPrinting}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 sm:px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-colors disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-sm sm:text-base shadow-lg"
                  >
                    <Bluetooth size={20} className="sm:w-6 sm:h-6" />
                    <span className="whitespace-nowrap">
                      {isPrinting ? "Printing..." : "🖨️ Print via Bluetooth"}
                    </span>
                  </button>

                  <button
                    onClick={handleBrowserPrint}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
                  >
                    <Printer size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">
                      Browser Print (Preview)
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {generatedCodes.length > 0 && (
            <>
              <h2 className="no-print text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">
                Preview ({generatedCodes.length} labels)
              </h2>
              <div className="print-grid grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                {generatedCodes.map((code, index) => (
                  <CodeItem key={index} code={code} type={codeType} />
                ))}
              </div>
            </>
          )}

          {generatedCodes.length === 0 && (
            <div className="no-print text-center text-gray-500 py-8 sm:py-12 text-sm sm:text-base">
              Enter details and click Generate to create scannable codes
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const CodeItem = ({ code, type }) => {
  const canvasRef = useRef(null);
  const barcodeRef = useRef(null);

  useEffect(() => {
    const generateCode = async () => {
      try {
        if (type === "barcode" && barcodeRef.current) {
          JsBarcode(barcodeRef.current, code, {
            format: "CODE128",
            width: 1.8,
            height: 60,
            displayValue: true,
            fontSize: 12,
            margin: 8,
            textMargin: 2,
          });
        } else if (type === "qrcode" && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, code, {
            width: 120,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
        } else if (type === "datamatrix" && canvasRef.current) {
          bwipjs.toCanvas(canvasRef.current, {
            bcid: "datamatrix",
            text: code,
            scale: 3,
            height: 10,
            includetext: false,
            textxalign: "center",
          });
        }
      } catch (err) {
        console.error("Error generating code:", err);
      }
    };

    generateCode();
  }, [code, type]);

  return (
    <div className="print-item label-preview bg-white rounded-xl shadow-md p-2 flex flex-col items-center justify-center hover:shadow-xl transition-shadow">
      {type === "barcode" ? (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <svg ref={barcodeRef} className="max-w-[90%] max-h-[90%]"></svg>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <canvas ref={canvasRef} className="max-w-[75%]"></canvas>
          <p className="text-[11px] sm:text-xs font-semibold text-gray-800 text-center">
            {code}
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
