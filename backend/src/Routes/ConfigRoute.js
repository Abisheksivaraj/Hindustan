const express = require("express");
const router = express.Router();
const GeneratedLabel = require("../Models/TableModel");

// Search for a specific label code
router.get("/search/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const label = await GeneratedLabel.findOne({ code })
      .populate("configId", "name baseName codeType")
      .populate("printHistoryId", "createdAt status printerName");

    if (!label) {
      return res.status(404).json({
        success: false,
        error: "Label not found",
      });
    }

    res.json({
      success: true,
      data: label,
    });
  } catch (error) {
    console.error("Error searching label:", error);
    res.status(500).json({
      error: "Failed to search label",
      message: error.message,
    });
  }
});

// Verify if code exists
router.get("/verify/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const exists = await GeneratedLabel.codeExists(code);

    res.json({
      success: true,
      data: {
        code,
        exists,
        message: exists ? "Code exists in database" : "Code not found",
      },
    });
  } catch (error) {
    console.error("Error verifying code:", error);
    res.status(500).json({
      error: "Failed to verify code",
      message: error.message,
    });
  }
});

// Get labels by base name
router.get("/by-basename/:baseName", async (req, res) => {
  try {
    const { baseName } = req.params;
    const { limit = 100 } = req.query;

    const labels = await GeneratedLabel.getByBaseName(
      baseName,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: labels,
      count: labels.length,
    });
  } catch (error) {
    console.error("Error fetching labels by basename:", error);
    res.status(500).json({
      error: "Failed to fetch labels",
      message: error.message,
    });
  }
});

// Get printer settings/preferences
router.get("/printer-settings", async (req, res) => {
  try {
    // In a real app, this would fetch from a settings collection
    const settings = {
      defaultPrinter: "TSC Alpha 40L",
      defaultConnection: "bluetooth",
      labelSize: {
        width: 50,
        height: 50,
        unit: "mm",
      },
      defaultCodeType: "barcode",
      baudRate: 9600,
      autoReconnect: true,
      printDelay: 300, // milliseconds between labels
    };

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching printer settings:", error);
    res.status(500).json({
      error: "Failed to fetch printer settings",
      message: error.message,
    });
  }
});

// Update printer settings
router.put("/printer-settings", async (req, res) => {
  try {
    const settings = req.body;

    // In a real app, save to database
    // For now, just echo back the settings

    res.json({
      success: true,
      message: "Printer settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating printer settings:", error);
    res.status(500).json({
      error: "Failed to update printer settings",
      message: error.message,
    });
  }
});

// Export data
router.get("/export/labels", async (req, res) => {
  try {
    const { baseName, startDate, endDate } = req.query;
    const query = {};

    if (baseName) query.baseName = baseName;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const labels = await GeneratedLabel.find(query)
      .select("code codeType baseName sequenceNumber isPrinted printedAt")
      .sort({ baseName: 1, sequenceNumber: 1 });

    res.json({
      success: true,
      data: labels,
      count: labels.length,
    });
  } catch (error) {
    console.error("Error exporting labels:", error);
    res.status(500).json({
      error: "Failed to export labels",
      message: error.message,
    });
  }
});

// System health check
router.get("/health", async (req, res) => {
  try {
    const [labelCount, historyCount, configCount] = await Promise.all([
      GeneratedLabel.countDocuments(),
      require("../Models/PrintHistory").countDocuments(),
      require("../Models/LabelConfig").countDocuments(),
    ]);

    res.json({
      success: true,
      status: "healthy",
      data: {
        totalLabels: labelCount,
        totalPrintJobs: historyCount,
        totalConfigs: configCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error checking system health:", error);
    res.status(500).json({
      success: false,
      status: "unhealthy",
      error: error.message,
    });
  }
});

module.exports = router;
