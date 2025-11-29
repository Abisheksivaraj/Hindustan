import React, { useState, useEffect, useRef } from "react";
import { Printer, Bluetooth, Download } from "lucide-react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import bwipjs from "bwip-js";

const App = () => {
  const [baseName, setBaseName] = useState("PA00001");
  const [quantity, setQuantity] = useState(10);
  const [codeType, setCodeType] = useState("barcode");
  const [generatedCodes, setGeneratedCodes] = useState([]);
  const [serialPort, setSerialPort] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

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
      if (!navigator.serial) {
        alert(
          "Web Serial API is not supported. Please use Chrome 117+ or Edge on Android/Desktop."
        );
        return;
      }

      // Request Bluetooth Serial Port
      const port = await navigator.serial.requestPort({
        // Allow standard SPP UUID
        filters: [
          { bluetoothServiceClassId: "00001101-0000-1000-8000-00805f9b34fb" },
        ],
      });

      // Open the serial port with appropriate settings for TSC printer
      await port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });

      setSerialPort(port);
      setIsConnected(true);
      alert("Successfully connected to TSC Alpha 40L printer!");
    } catch (error) {
      console.error("Connection error:", error);
      alert("Failed to connect: " + error.message);
    }
  };

  const disconnectPrinter = async () => {
    try {
      if (serialPort) {
        await serialPort.close();
        setSerialPort(null);
        setIsConnected(false);
        alert("Disconnected from printer");
      }
    } catch (error) {
      console.error("Disconnect error:", error);
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

    if (codeType === "barcode") {
      tspl += `BARCODE 50,80,"128",60,1,0,2,2,"${code}"\r\n`;
      tspl += `TEXT 70,150,"3",0,1,1,"${code}"\r\n`;
    } else if (codeType === "qrcode") {
      tspl += `QRCODE 60,50,H,5,A,0,"${code}"\r\n`;
      tspl += `TEXT 70,160,"3",0,1,1,"${code}"\r\n`;
    } else if (codeType === "datamatrix") {
      tspl += `DMATRIX 50,50,140,140,"${code}"\r\n`;
      tspl += `TEXT 70,160,"3",0,1,1,"${code}"\r\n`;
    }

    tspl += `PRINT 1,1\r\n`;

    return tspl;
  };

  const printViaBluetooth = async () => {
    if (!isConnected || !serialPort) {
      alert("Please connect to printer first");
      return;
    }

    if (generatedCodes.length === 0) {
      alert("Please generate codes first");
      return;
    }

    setIsPrinting(true);

    try {
      const writer = serialPort.writable.getWriter();
      const encoder = new TextEncoder();

      for (const code of generatedCodes) {
        const tsplCommand = generateTSPLCommand(code);
        const data = encoder.encode(tsplCommand);

        await writer.write(data);

        // Wait for printer to process
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      writer.releaseLock();
      alert(`Successfully printed ${generatedCodes.length} labels!`);
    } catch (error) {
      console.error("Print error:", error);
      alert("Failed to print: " + error.message);
    } finally {
      setIsPrinting(false);
    }
  };

  const printViaUSB = async () => {
    if (generatedCodes.length === 0) {
      alert("Please generate codes first");
      return;
    }

    try {
      if (!navigator.serial) {
        alert("Web Serial API is not supported. Use Chrome/Edge on desktop.");
        return;
      }

      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });

      const writer = port.writable.getWriter();
      const encoder = new TextEncoder();

      for (const code of generatedCodes) {
        const tsplCommand = generateTSPLCommand(code);
        const data = encoder.encode(tsplCommand);
        await writer.write(data);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      writer.releaseLock();
      await port.close();

      alert(`Successfully printed ${generatedCodes.length} labels via USB!`);
    } catch (error) {
      console.error("USB Print error:", error);
      alert("Failed to print via USB: " + error.message);
    }
  };

  const downloadTSPLFile = () => {
    if (generatedCodes.length === 0) {
      alert("Please generate codes first");
      return;
    }

    let tsplContent = "";
    generatedCodes.forEach((code) => {
      tsplContent += generateTSPLCommand(code) + "\n";
    });

    const blob = new Blob([tsplContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `labels_${baseName}_${quantity}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 50mm) !important;
            gap: 5mm !important;
            padding: 0 !important;
          }
          
          .print-item {
            width: 50mm !important;
            height: 50mm !important;
            box-sizing: border-box !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            padding: 2mm !important;
            border: 1px solid #e5e7eb !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            background: white !important;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
        }
        
        .label-preview {
          width: 100%;
          aspect-ratio: 1;
          max-width: 189px;
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
          {/* Header - Responsive */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
              TSC Alpha 40L - Direct Bluetooth Print
            </h1>

            {/* Connection Status */}
            <div className="no-print flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {isConnected ? (
                <div className="flex items-center gap-2 w-full sm:w-auto bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm text-green-700 font-medium">
                    Connected to PS-9CF636
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
                  <span className="whitespace-nowrap">
                    Connect via Bluetooth
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Browser Compatibility Notice */}
          <div className="no-print bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs sm:text-sm text-blue-800">
            <strong>📱 Requirements:</strong> Chrome 117+ or Edge on
            Android/Desktop. Make sure your TSC Alpha 40L is paired in device
            Bluetooth settings first.
          </div>

          {/* Input Form - Responsive */}
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
                <strong>Label Size:</strong> 50mm × 50mm for TSC Alpha 40L
                printer
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
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    <Bluetooth size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">
                      {isPrinting
                        ? "Printing..."
                        : "Print via Bluetooth (Direct)"}
                    </span>
                  </button>

                  <button
                    onClick={printViaUSB}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm sm:text-base"
                  >
                    <Printer size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">
                      Print via USB (Desktop)
                    </span>
                  </button>

                  <button
                    onClick={downloadTSPLFile}
                    className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm sm:text-base"
                  >
                    <Download size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">
                      Download TSPL (Backup)
                    </span>
                  </button>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-3 text-xs sm:text-sm text-yellow-800">
                    <strong>📱 Bluetooth Printing Steps:</strong>
                    <ol className="list-decimal ml-3 sm:ml-4 mt-1 sm:mt-2 space-y-1">
                      <li>
                        <strong>Pair first:</strong> Go to device Bluetooth
                        settings → Pair with PS-9CF636
                      </li>
                      <li>
                        Click <strong>"Connect via Bluetooth"</strong> above
                      </li>
                      <li>
                        Select <strong>PS-9CF636</strong> from the list
                      </li>
                      <li>
                        Click <strong>"Print via Bluetooth"</strong> to print
                        labels
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Generated Codes Preview - Responsive Grid */}
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
            width: 1.5,
            height: 50,
            displayValue: true,
            fontSize: 10,
            margin: 5,
          });
        } else if (type === "qrcode" && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, code, {
            width: 140,
            margin: 1,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
        } else if (type === "datamatrix" && canvasRef.current) {
          bwipjs.toCanvas(canvasRef.current, {
            bcid: "datamatrix",
            text: code,
            scale: 4,
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
    <div className="print-item label-preview bg-white rounded-lg shadow-sm p-2 flex flex-col items-center justify-center border border-gray-200">
      {type === "barcode" ? (
        <div className="flex flex-col items-center w-full h-full justify-center">
          <svg ref={barcodeRef} className="max-w-full max-h-full"></svg>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <canvas ref={canvasRef} className="max-w-full"></canvas>
          <p className="text-[10px] sm:text-xs font-medium mt-1 text-gray-700 truncate max-w-full px-1">
            {code}
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
