import React, { useState } from "react";

export default function TSCBluetoothPrint() {
  const [device, setDevice] = useState(null);
  const [server, setServer] = useState(null);
  const [status, setStatus] = useState("");
  const [zpl, setZpl] = useState("");
  const [log, setLog] = useState("");

  // -----------------------------
  // 1. CONNECT TO TSC PRINTER
  // -----------------------------
  const connectPrinter = async () => {
    try {
      setStatus("Scanning...");
      const selectedDevice = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "TSC" }],
        optionalServices: [0xffe0, 0xffe1], // TSC BLE service
      });

      setDevice(selectedDevice);
      setStatus("Connecting...");

      const gattServer = await selectedDevice.gatt.connect();
      setServer(gattServer);

      setStatus("Connected to " + selectedDevice.name);
      appendLog("Connected to printer");
    } catch (err) {
      setStatus("Error: " + err.message);
      appendLog("Connection failed");
    }
  };

  // ---------------------------------
  // 2. SEND ZPL / TSPL TO PRINTER
  // ---------------------------------
  const print = async () => {
    if (!server) {
      appendLog("Printer not connected");
      return;
    }

    try {
      const service = await server.getPrimaryService(0xffe0);
      const characteristic = await service.getCharacteristic(0xffe1);

      const encoder = new TextEncoder();
      await characteristic.writeValue(encoder.encode(zpl));

      appendLog("Printed Successfully");
    } catch (err) {
      appendLog("Print Error: " + err.message);
    }
  };

  const appendLog = (msg) => {
    setLog((prev) => prev + msg + "\n");
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>TSC Alpha-40L Bluetooth Print</h2>

      <button onClick={connectPrinter} style={{ marginBottom: 10 }}>
        Connect Printer
      </button>

      <p>Status: {status}</p>

      <textarea
        rows={10}
        value={zpl}
        onChange={(e) => setZpl(e.target.value)}
        placeholder="Enter TSPL / ZPL / CPCL code here…"
        style={{ width: "100%", marginTop: 10 }}
      />

      <button onClick={print} style={{ marginTop: 10 }}>
        Print
      </button>

      <h3>Output Log:</h3>
      <pre
        style={{
          background: "#eee",
          padding: 10,
          height: 150,
          overflowY: "scroll",
        }}
      >
        {log}
      </pre>
    </div>
  );
}
