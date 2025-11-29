import React, { useState, useEffect, useRef } from "react";
import { Printer, Bluetooth, Download, AlertCircle } from "lucide-react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import bwipjs from "bwip-js";

import logo from "../src/assets/logo.png";

const App = () => {
  const [baseName, setBaseName] = useState("PA00001");
  const [quantity, setQuantity] = useState(10);
  const [codeType, setCodeType] = useState("barcode");
  const [generatedCodes, setGeneratedCodes] = useState([]);
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const [bluetoothCharacteristic, setBluetoothCharacteristic] = useState(null);
  const [serialPort, setSerialPort] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [connectionType, setConnectionType] = useState(null); // 'bluetooth' or 'serial'

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

  // Web Bluetooth API Connection (Works on Mobile Chrome)
  const connectViaWebBluetooth = async () => {
    try {
      if (!navigator.bluetooth) {
        alert(
          "⚠️ Web Bluetooth API is not supported on this browser.\n\n" +
            "Please use Chrome or Edge."
        );
        return;
      }

      // Request Bluetooth device
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: "TSC" },
          { namePrefix: "TSC" },
          { namePrefix: "PS-" },
        ],
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb", // Nordic UART Service
          "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip Serial Port Service
          "0000fff0-0000-1000-8000-00805f9b34fb", // Common Serial Service
        ],
      });

      console.log("Connecting to device:", device.name);
      const server = await device.gatt.connect();

      // Try different service UUIDs
      let service;
      let characteristic;

      try {
        // Try Nordic UART Service first
        service = await server.getPrimaryService(
          "000018f0-0000-1000-8000-00805f9b34fb"
        );
        characteristic = await service.getCharacteristic(
          "00002af1-0000-1000-8000-00805f9b34fb"
        );
        console.log("Connected using Nordic UART Service");
      } catch (error1) {
        console.log("Nordic UART Service not found:", error1.message);
        try {
          // Try Microchip Serial Port Service
          service = await server.getPrimaryService(
            "49535343-fe7d-4ae5-8fa9-9fafd205e455"
          );
          characteristic = await service.getCharacteristic(
            "49535343-8841-43f4-a8d4-ecbe34729bb3"
          );
          console.log("Connected using Microchip Serial Port Service");
        } catch (error2) {
          console.log(
            "Microchip Serial Port Service not found:",
            error2.message
          );
          try {
            // Try common serial service
            service = await server.getPrimaryService(
              "0000fff0-0000-1000-8000-00805f9b34fb"
            );
            characteristic = await service.getCharacteristic(
              "0000fff1-0000-1000-8000-00805f9b34fb"
            );
            console.log("Connected using Common Serial Service");
          } catch (error3) {
            console.log("Common Serial Service not found:", error3.message);
            throw new Error(
              "Could not find compatible Bluetooth service. Your printer may not support BLE printing."
            );
          }
        }
      }

      setBluetoothDevice(device);
      setBluetoothCharacteristic(characteristic);
      setIsConnected(true);
      setConnectionType("bluetooth");
      alert(`✅ Successfully connected to ${device.name} via Bluetooth!`);
    } catch (error) {
      console.error("Bluetooth connection error:", error);
      if (error.name === "NotFoundError") {
        alert("❌ No device selected. Please try again.");
      } else {
        alert("❌ Failed to connect via Bluetooth: " + error.message);
      }
    }
  };

  // Web Serial API Connection (Desktop Chrome/Edge only)
  const connectViaWebSerial = async () => {
    try {
      if (!navigator.serial) {
        alert(
          "⚠️ Web Serial API is not supported on this browser.\n\n" +
            "Please use the Bluetooth option instead."
        );
        return;
      }

      // Request Serial Port
      const port = await navigator.serial.requestPort({
        filters: [
          { bluetoothServiceClassId: "00001101-0000-1000-8000-00805f9b34fb" },
        ],
      });

      await port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });

      setSerialPort(port);
      setIsConnected(true);
      setConnectionType("serial");
      alert("✅ Successfully connected via Serial!");
    } catch (error) {
      console.error("Serial connection error:", error);
      if (error.name === "NotFoundError") {
        alert("❌ No device selected. Please try again.");
      } else {
        alert("❌ Failed to connect via Serial: " + error.message);
      }
    }
  };

  const connectPrinter = async () => {
    // Try Web Bluetooth first (works on mobile)
    if (navigator.bluetooth) {
      await connectViaWebBluetooth();
    }
    // Fall back to Web Serial (desktop only)
    else if (navigator.serial) {
      await connectViaWebSerial();
    } else {
      alert(
        "⚠️ Your browser doesn't support Bluetooth or Serial printing.\n\n" +
          "Please use Chrome or Edge, or download the TSPL file instead."
      );
    }
  };

  const disconnectPrinter = async () => {
    try {
      if (connectionType === "bluetooth" && bluetoothDevice) {
        if (bluetoothDevice.gatt.connected) {
          bluetoothDevice.gatt.disconnect();
        }
        setBluetoothDevice(null);
        setBluetoothCharacteristic(null);
      } else if (connectionType === "serial" && serialPort) {
        await serialPort.close();
        setSerialPort(null);
      }

      setIsConnected(false);
      setConnectionType(null);
      alert("Disconnected from printer");
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

    // Add border on all 4 sides (2mm from edge)
    tspl += `BOX 8,8,376,376,2\r\n`;

    if (codeType === "barcode") {
      // Centered barcode
      tspl += `BARCODE 60,100,"128",70,1,0,2,2,"${code}"\r\n`;
      tspl += `TEXT 100,185,"3",0,1,1,"${code}"\r\n`;
    } else if (codeType === "qrcode") {
      // Centered QR code
      tspl += `QRCODE 100,70,H,5,A,0,"${code}"\r\n`;
      tspl += `TEXT 120,200,"3",0,1,1,"${code}"\r\n`;
    } else if (codeType === "datamatrix") {
      // Centered Data Matrix
      tspl += `DMATRIX 90,70,140,140,"${code}"\r\n`;
      tspl += `TEXT 120,200,"3",0,1,1,"${code}"\r\n`;
    }

    tspl += `PRINT 1,1\r\n`;

    return tspl;
  };

  // Send data via Web Bluetooth
  const sendViaBluetooth = async (data) => {
    if (!bluetoothCharacteristic) {
      throw new Error("Not connected to Bluetooth device");
    }

    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);

    // BLE has a maximum packet size (typically 20 bytes for older devices, up to 512 for newer)
    // We'll use 20 bytes to be safe
    const chunkSize = 20;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
      await bluetoothCharacteristic.writeValue(chunk);
      // Small delay between chunks
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  // Send data via Web Serial
  const sendViaSerial = async (data) => {
    if (!serialPort) {
      throw new Error("Not connected to Serial device");
    }

    const writer = serialPort.writable.getWriter();
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);

    await writer.write(bytes);
    writer.releaseLock();
  };

  const printLabels = async () => {
    if (!isConnected) {
      alert("Please connect to printer first");
      return;
    }

    if (generatedCodes.length === 0) {
      alert("Please generate codes first");
      return;
    }

    setIsPrinting(true);

    try {
      for (const code of generatedCodes) {
        const tsplCommand = generateTSPLCommand(code);

        if (connectionType === "bluetooth") {
          await sendViaBluetooth(tsplCommand);
        } else if (connectionType === "serial") {
          await sendViaSerial(tsplCommand);
        }

        // Wait for printer to process
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      alert(`✅ Successfully printed ${generatedCodes.length} labels!`);
    } catch (error) {
      console.error("Print error:", error);
      alert("❌ Failed to print: " + error.message);
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
        alert(
          "⚠️ Web Serial API is not supported on this browser.\n\n" +
            "Please use the Bluetooth option or download the TSPL file instead."
        );
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

      alert(`✅ Successfully printed ${generatedCodes.length} labels via USB!`);
    } catch (error) {
      console.error("USB Print error:", error);
      alert("❌ Failed to print via USB: " + error.message);
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

    alert("✅ TSPL file downloaded successfully!");
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
            border: 2px solid #000000 !important;
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

      {/* Navbar */}
      <nav className="no-print bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-[1550px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo - Left Side */}
            <div className="flex items-center">
              <img
                src={logo}
                alt="Company Logo"
                className="h-8 sm:h-10 w-auto"
              />
            </div>

            {/* Bluetooth Connection Button - Right Side */}
            <div className="flex items-center">
              {isConnected ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm text-green-700 font-medium hidden sm:inline">
                    Connected (
                    {connectionType === "bluetooth" ? "BLE" : "Serial"})
                  </span>
                  <span className="text-xs sm:text-sm text-green-700 font-medium sm:hidden">
                    Connected
                  </span>
                  <button
                    onClick={disconnectPrinter}
                    className="ml-2 px-2 sm:px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectPrinter}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                >
                  <Bluetooth size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span className="whitespace-nowrap">Connect Printer</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-[1550px] mx-auto w-full">
          {/* Header - Responsive */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
              TSC Alpha 40L - Bluetooth Print (Mobile & Desktop)
            </h1>
          </div>

          {/* Browser Compatibility Notice */}
          <div className="no-print bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs sm:text-sm text-blue-800">
            <strong>📱 Works on Mobile & Desktop!</strong> This app now supports
            Bluetooth printing on mobile Chrome using Web Bluetooth API. Make
            sure your TSC printer supports Bluetooth Low Energy (BLE).
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
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "0") {
                      setQuantity("");
                    } else {
                      const numValue = parseInt(value);
                      if (!isNaN(numValue) && numValue >= 0) {
                        setQuantity(numValue);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === "" || parseInt(value) < 1) {
                      setQuantity(1);
                    }
                  }}
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
                    onClick={printLabels}
                    disabled={!isConnected || isPrinting}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    <Bluetooth size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">
                      {isPrinting ? "Printing..." : "Print via Bluetooth"}
                    </span>
                  </button>

                  {navigator.serial && (
                    <button
                      onClick={printViaUSB}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm sm:text-base"
                    >
                      <Printer size={18} className="sm:w-5 sm:h-5" />
                      <span className="whitespace-nowrap">
                        Print via USB (Desktop Only)
                      </span>
                    </button>
                  )}

                  <button
                    onClick={downloadTSPLFile}
                    className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm sm:text-base"
                  >
                    <Download size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">
                      Download TSPL File (Backup)
                    </span>
                  </button>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-3 text-xs sm:text-sm text-yellow-800">
                    <strong>📱 Bluetooth Printing Steps:</strong>
                    <ol className="list-decimal ml-3 sm:ml-4 mt-1 sm:mt-2 space-y-1">
                      <li>
                        <strong>Enable Bluetooth:</strong> Turn on Bluetooth on
                        your device
                      </li>
                      <li>
                        <strong>Turn on printer:</strong> Make sure TSC Alpha
                        40L is powered on
                      </li>
                      <li>
                        Click <strong>"Connect Printer"</strong> button above
                      </li>
                      <li>
                        Select your <strong>TSC printer</strong> from the list
                      </li>
                      <li>
                        Click <strong>"Print via Bluetooth"</strong> to print
                        labels
                      </li>
                    </ol>
                    <div className="mt-2 pt-2 border-t border-yellow-300">
                      <strong>⚠️ Important:</strong> Your TSC printer must
                      support <strong>Bluetooth Low Energy (BLE)</strong> for
                      mobile printing. If connection fails, your printer may
                      only support classic Bluetooth, which requires desktop
                      Chrome.
                    </div>
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
