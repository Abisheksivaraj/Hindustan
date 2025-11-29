const mongoose = require("mongoose");

const printHistorySchema = new mongoose.Schema(
  {
    configId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabelConfig",
      required: false,
    },
    baseName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    codeType: {
      type: String,
      required: true,
      enum: ["barcode", "qrcode", "datamatrix"],
    },
    generatedCodes: [
      {
        type: String,
      },
    ],
    connectionType: {
      type: String,
      enum: ["bluetooth", "serial", "usb", "download"],
      required: true,
    },
    printerName: {
      type: String,
      default: "Unknown",
    },
    status: {
      type: String,
      enum: ["success", "failed", "partial"],
      required: true,
    },
    printedCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    duration: {
      type: Number, // in milliseconds
      default: 0,
    },
    deviceInfo: {
      userAgent: String,
      platform: String,
      browserName: String,
    },
    printedBy: {
      type: String,
      default: "system",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for queries
printHistorySchema.index({ createdAt: -1 });
printHistorySchema.index({ baseName: 1 });
printHistorySchema.index({ status: 1 });
printHistorySchema.index({ connectionType: 1 });

// Virtual for success rate
printHistorySchema.virtual("successRate").get(function () {
  if (this.quantity === 0) return 0;
  return (this.printedCount / this.quantity) * 100;
});

// Static method to get statistics
printHistorySchema.statics.getStatistics = async function (startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalPrints: { $sum: 1 },
        totalLabels: { $sum: "$quantity" },
        successfulPrints: {
          $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
        },
        failedPrints: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        bluetoothPrints: {
          $sum: { $cond: [{ $eq: ["$connectionType", "bluetooth"] }, 1, 0] },
        },
        serialPrints: {
          $sum: { $cond: [{ $eq: ["$connectionType", "serial"] }, 1, 0] },
        },
        usbPrints: {
          $sum: { $cond: [{ $eq: ["$connectionType", "usb"] }, 1, 0] },
        },
        downloads: {
          $sum: { $cond: [{ $eq: ["$connectionType", "download"] }, 1, 0] },
        },
        avgDuration: { $avg: "$duration" },
      },
    },
  ]);
};

const PrintHistory = mongoose.model("PrintHistory", printHistorySchema);

module.exports = PrintHistory;
