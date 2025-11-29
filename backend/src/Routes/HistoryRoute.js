const express = require("express");
const router = express.Router();
const PrintHistory = require("../Models/PrintHistory");
const GeneratedLabel = require("../Models/TableModel");

// Create new print history record
router.post("/", async (req, res) => {
  try {
    const {
      configId,
      baseName,
      quantity,
      codeType,
      generatedCodes,
      connectionType,
      printerName,
      status,
      printedCount,
      errorMessage,
      duration,
      deviceInfo,
      printedBy,
    } = req.body;

    const printHistory = new PrintHistory({
      configId,
      baseName,
      quantity,
      codeType,
      generatedCodes: generatedCodes || [],
      connectionType,
      printerName: printerName || "Unknown",
      status,
      printedCount: printedCount || (status === "success" ? quantity : 0),
      errorMessage,
      duration: duration || 0,
      deviceInfo,
      printedBy: printedBy || "system",
    });

    await printHistory.save();

    // If successful, mark labels as printed
    if (status === "success" && generatedCodes && generatedCodes.length > 0) {
      await GeneratedLabel.updateMany(
        { code: { $in: generatedCodes } },
        {
          $set: {
            isPrinted: true,
            printedAt: new Date(),
            status: "printed",
            printHistoryId: printHistory._id,
          },
          $inc: { printCount: 1 },
        }
      );
    }

    res.status(201).json({
      success: true,
      message: "Print history recorded successfully",
      data: printHistory,
    });
  } catch (error) {
    console.error("Error creating print history:", error);
    res.status(500).json({
      error: "Failed to record print history",
      message: error.message,
    });
  }
});

// Get all print history with pagination and filters
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      connectionType,
      baseName,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (connectionType) query.connectionType = connectionType;
    if (baseName) query.baseName = new RegExp(baseName, "i");

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const history = await PrintHistory.find(query)
      .populate("configId", "name baseName")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await PrintHistory.countDocuments(query);

    res.json({
      success: true,
      data: history,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    });
  } catch (error) {
    console.error("Error fetching print history:", error);
    res.status(500).json({
      error: "Failed to fetch print history",
      message: error.message,
    });
  }
});

// Get single print history by ID
router.get("/:id", async (req, res) => {
  try {
    const history = await PrintHistory.findById(req.params.id).populate(
      "configId"
    );

    if (!history) {
      return res.status(404).json({ error: "Print history not found" });
    }

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching print history:", error);
    res.status(500).json({
      error: "Failed to fetch print history",
      message: error.message,
    });
  }
});

// Get print statistics
router.get("/stats/summary", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await PrintHistory.getStatistics(startDate, endDate);

    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          totalPrints: 0,
          totalLabels: 0,
          successfulPrints: 0,
          failedPrints: 0,
          successRate: 0,
          bluetoothPrints: 0,
          serialPrints: 0,
          usbPrints: 0,
          downloads: 0,
          avgDuration: 0,
        },
      });
    }

    const data = stats[0];
    data.successRate =
      data.totalPrints > 0
        ? ((data.successfulPrints / data.totalPrints) * 100).toFixed(2)
        : 0;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      message: error.message,
    });
  }
});

// Get daily print statistics
router.get("/stats/daily", async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const dailyStats = await PrintHistory.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalPrints: { $sum: 1 },
          totalLabels: { $sum: "$quantity" },
          successfulPrints: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failedPrints: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.json({
      success: true,
      data: dailyStats,
    });
  } catch (error) {
    console.error("Error fetching daily statistics:", error);
    res.status(500).json({
      error: "Failed to fetch daily statistics",
      message: error.message,
    });
  }
});

// Get most printed labels
router.get("/stats/top-labels", async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topLabels = await PrintHistory.aggregate([
      {
        $group: {
          _id: "$baseName",
          totalPrints: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          lastPrinted: { $max: "$createdAt" },
        },
      },
      {
        $sort: { totalQuantity: -1 },
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    res.json({
      success: true,
      data: topLabels,
    });
  } catch (error) {
    console.error("Error fetching top labels:", error);
    res.status(500).json({
      error: "Failed to fetch top labels",
      message: error.message,
    });
  }
});

// Delete print history
router.delete("/:id", async (req, res) => {
  try {
    const history = await PrintHistory.findByIdAndDelete(req.params.id);

    if (!history) {
      return res.status(404).json({ error: "Print history not found" });
    }

    res.json({
      success: true,
      message: "Print history deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting print history:", error);
    res.status(500).json({
      error: "Failed to delete print history",
      message: error.message,
    });
  }
});

// Bulk delete print history
router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids, olderThan } = req.body;

    let result;

    if (ids && ids.length > 0) {
      result = await PrintHistory.deleteMany({ _id: { $in: ids } });
    } else if (olderThan) {
      const cutoffDate = new Date(olderThan);
      result = await PrintHistory.deleteMany({
        createdAt: { $lt: cutoffDate },
      });
    } else {
      return res.status(400).json({
        error: "Please provide either ids or olderThan parameter",
      });
    }

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} print history records`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting print history:", error);
    res.status(500).json({
      error: "Failed to delete print history",
      message: error.message,
    });
  }
});

module.exports = router;
