import React, { useState, useEffect, useRef } from "react";
import {
  Printer,
  Bluetooth,
  Download,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
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
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

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
        setStatus("❌ Web Bluetooth is not supported on this browser/device");
        setShowTroubleshooting(true);
        return;
      }

      setStatus("📱 Opening Bluetooth device selector...");
      setShowTroubleshooting(false);

      // Request device with filters for TSC printers
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: "TSC" },
          { namePrefix: "Alpha" },
          { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
        ],
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb", // Common printer service
          "49535343-fe7d-4ae5-8fa9-9fafd205e455", // HM-10/BLE service
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Nordic UART
          "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Generic UART
          "0000ffe0-0000-1000-8000-00805f9b34fb", // Another common service
        ],
      });

      setStatus(`🔄 Connecting to ${device.name || "printer"}...`);
      const server = await device.gatt.connect();

      setStatus("🔍 Discovering printer services...");
      const services = await server.getPrimaryServices();

      console.log(
        "Available services:",
        services.map((s) => s.uuid)
      );

      let foundChar = null;
      let serviceUsed = null;

      // Try to find writable characteristic
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          console.log(
            `Service ${service.uuid} characteristics:`,
            characteristics.map((c) => ({
              uuid: c.uuid,
              properties: c.properties,
            }))
          );

          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              foundChar = char;
              serviceUsed = service.uuid;
              setStatus(
                `✅ Found writable characteristic in service ${service.uuid.substring(
                  0,
                  8
                )}...`
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
          "No writable characteristic found. The printer may not be in pairing mode or is incompatible."
        );
      }

      setPrinterChar(foundChar);
      setBluetoothDevice(device);
      setIsConnected(true);
      setStatus(`✅ Connected to ${device.name || "TSC Printer"}`);

      // Listen for disconnection
      device.addEventListener("gattserverdisconnected", () => {
        setIsConnected(false);
        setBluetoothDevice(null);
        setPrinterChar(null);
        setStatus("⚠️ Printer disconnected");
      });
    } catch (error) {
      console.error("Bluetooth error:", error);

      if (error.message.includes("User cancelled")) {
        setStatus("❌ Connection cancelled - No device selected");
        setShowTroubleshooting(true);
      } else if (error.message.includes("No writable characteristic")) {
        setStatus(`❌ ${error.message}`);
        setShowTroubleshooting(true);
      } else {
        setStatus(`❌ Connection failed: ${error.message}`);
        setShowTroubleshooting(true);
      }
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

    // Common header for all label types
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

    if (codeType === "barcode") {
      tspl += `BOX 8,8,376,376,2\r\n`;
      tspl += `BARCODE 120,100,"128",100,0,0,2,3,"${code}"\r\n`;
      tspl += `TEXT 150,220,"4",0,1,1,"${code}"\r\n`;
    } else if (codeType === "qrcode") {
      tspl += `BOX 8,8,376,376,2\r\n`;
      tspl += `QRCODE 100,60,H,8,A,0,"${code}"\r\n`;
      tspl += `TEXT 140,315,"4",0,1,1,"${code}"\r\n`;
    } else if (codeType === "datamatrix") {
      tspl += `BOX 20,20,386,386,2\r\n`;
      tspl += `DMATRIX 203,203,30,30,X,8,"${code}"\r\n`;
      tspl += `TEXT 160,320,"0",0,1,1,"${code}"\r\n`;
    }

    tspl += `PRINT 1,1\r\n`;
    return tspl;
  };

  const generateZPLCommand = (code) => {
    let zpl = "";
    zpl += `^XA\n`;
    zpl += `^PW394\n`;
    zpl += `^LL394\n`;

    if (codeType === "barcode") {
      zpl += `^FO8,8^GB368,368,2^FS\n`;
      zpl += `^FO117,100^BY2,3^BCN,100,N,N,N\n`;
      zpl += `^FD${code}^FS\n`;
      zpl += `^FO150,220^A0N,30,30^FD${code}^FS\n`;
    } else if (codeType === "qrcode") {
      zpl += `^FO8,8^GB368,368,2^FS\n`;
      zpl += `^FO100,60^BQN,2,8^FDQA,${code}^FS\n`;
      zpl += `^FO140,315^A0N,30,30^FD${code}^FS\n`;
    } else if (codeType === "datamatrix") {
      zpl += `^FO20,20^GB366,366,2^FS\n`;
      zpl += `^FO137,100^BXN,8,200^FD${code}^FS\n`;
      zpl += `^FO147,280^A0N,30,30^FD${code}^FS\n`;
    }

    zpl += `^XZ\n`;
    return zpl;
  };

  const downloadTSPL = () => {
    if (generatedCodes.length === 0) {
      alert("Please generate codes first");
      return;
    }

    let allTSPL = "";
    generatedCodes.forEach((code) => {
      allTSPL += generateTSPLCommand(code);
      allTSPL += "\n";
    });

    const blob = new Blob([allTSPL], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `labels_TSC_${baseName}_${generatedCodes.length}x.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatus(`✅ Downloaded ${generatedCodes.length} labels as TSPL file`);
  };

  const downloadZPL = () => {
    if (generatedCodes.length === 0) {
      alert("Please generate codes first");
      return;
    }

    let allZPL = "";
    generatedCodes.forEach((code) => {
      allZPL += generateZPLCommand(code);
      allZPL += "\n";
    });

    const blob = new Blob([allZPL], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `labels_ZPL_${baseName}_${generatedCodes.length}x.zpl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatus(`✅ Downloaded ${generatedCodes.length} labels as ZPL file`);
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
        setStatus(`🖨️ Printing ${i + 1}/${generatedCodes.length}...`);

        const tsplCommand = generateTSPLCommand(code);
        const data = encoder.encode(tsplCommand);

        // Send in chunks to avoid buffer overflow
        const chunkSize = 512;
        for (let offset = 0; offset < data.length; offset += chunkSize) {
          const chunk = data.slice(offset, offset + chunkSize);

          try {
            if (printerChar.properties.writeWithoutResponse) {
              await printerChar.writeValueWithoutResponse(chunk);
            } else {
              await printerChar.writeValue(chunk);
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          } catch (writeError) {
            console.error("Write error:", writeError);
            throw new Error(`Failed to send data: ${writeError.message}`);
          }
        }

        // Wait between labels
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setStatus(`✅ Successfully printed ${generatedCodes.length} labels!`);
      alert(`✅ Successfully printed ${generatedCodes.length} labels!`);
    } catch (error) {
      console.error("Print error:", error);
      setStatus(`❌ Print error: ${error.message}`);
      alert("Failed to print: " + error.message);
      setShowTroubleshooting(true);
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
      `}</style>

      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-[1550px] mx-auto w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
              TSC Alpha 40L - Zebra HHT Bluetooth
            </h1>

            <div className="no-print flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {isConnected ? (
                <div className="flex items-center gap-2 w-full sm:w-auto bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle size={16} className="text-green-600" />
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
            <div
              className={`no-print border rounded-lg p-3 mb-4 text-sm ${
                status.includes("❌") || status.includes("⚠️")
                  ? "bg-red-50 border-red-300 text-red-800"
                  : status.includes("✅")
                  ? "bg-green-50 border-green-300 text-green-800"
                  : "bg-blue-50 border-blue-300 text-blue-800"
              }`}
            >
              <strong>Status:</strong> {status}
            </div>
          )}

          {showTroubleshooting && (
            <div className="no-print bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="text-yellow-600 flex-shrink-0 mt-1"
                  size={24}
                />
                <div className="flex-1">
                  <h3 className="font-bold text-yellow-900 mb-2">
                    Troubleshooting Steps:
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
                    <li>
                      <strong>Turn ON Bluetooth</strong> on your Zebra handheld
                      device in Android settings
                    </li>
                    <li>
                      <strong>Power ON</strong> the TSC Alpha 40L printer
                    </li>
                    <li>
                      <strong>Enable Bluetooth pairing mode</strong> on the
                      printer:
                      <ul className="list-disc list-inside ml-6 mt-1">
                        <li>Check printer manual for pairing button/menu</li>
                        <li>LED should blink indicating pairing mode</li>
                      </ul>
                    </li>
                    <li>
                      <strong>DO NOT pre-pair</strong> in Android Bluetooth
                      settings - let the web app discover the device
                    </li>
                    <li>
                      Click "Connect Bluetooth" and{" "}
                      <strong>select your TSC printer</strong> from the list
                    </li>
                    <li>
                      If the printer doesn't appear, move closer (within 1-2
                      meters)
                    </li>
                    <li>
                      Try restarting both the printer and the Zebra device if
                      issues persist
                    </li>
                  </ol>
                  <button
                    onClick={() => setShowTroubleshooting(false)}
                    className="mt-3 px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="no-print bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-3 mb-4 text-xs sm:text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">📱</span>
              <div>
                <strong className="text-blue-900">
                  Zebra HHT (Android) → TSC Alpha 40L
                </strong>
                <p className="text-blue-800 mt-1">
                  Uses Web Bluetooth API. Make sure the printer is powered on
                  and in Bluetooth pairing mode before connecting.
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
                    onClick={downloadTSPL}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors text-sm sm:text-base"
                  >
                    <Download size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">
                      Download TSPL File (TSC)
                    </span>
                  </button>

                  <button
                    onClick={downloadZPL}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-colors text-sm sm:text-base"
                  >
                    <Download size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">
                      Download ZPL File (Zebra)
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
            width: 2,
            height: 70,
            displayValue: false,
            fontSize: 14,
            margin: 8,
          });
        } else if (type === "qrcode" && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, code, {
            width: 140,
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
            scale: 5.5,
            height: 15,
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
        <div className="flex flex-col items-center justify-center w-full h-full gap-2">
          <svg ref={barcodeRef} className="max-w-[90%]"></svg>
          <p className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
            {code}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <canvas ref={canvasRef} className="max-w-[80%]"></canvas>
          <p className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
            {code}
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
